#!/usr/bin/env node
/*
 * 핀로그 클립싱크 에이전트 (macOS / Windows / Linux, Node 18+)
 * ------------------------------------------------------------
 * OS 클립보드(텍스트·이미지·파일)를 감시해 변경되면 핀로그로 업로드하고,
 * 다른 기기에서 올라온 새 클립은 이 기기의 클립보드에 자동 반영한다.
 * → 맥북에서 ⌘C(스크린샷·파인더 파일 포함) 하면 윈도우에서 바로 Ctrl+V.
 *   파일(jpg·pdf·md 등)은 원본 바이트 그대로 전송 — 변환 없음.
 *
 * 설정: ~/.pinlog-clipsync.json
 *   { "email": "...", "password": "...", "twoWay": true, "notify": true }
 */

const { execSync, execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SUPABASE_URL = "https://dklpbpldgnwckyfgikdt.supabase.co";
const ANON_KEY = "sb_publishable_TUVifI_U6Ht2PFN6BfOGEw_RDKjmUEE";
const CFG_PATH = path.join(os.homedir(), ".pinlog-clipsync.json");
const POLL_LOCAL_MS = 1200;
const POLL_REMOTE_MS = 2500;
const MAX_TEXT = 10000;
const MAX_IMG = 8 * 1024 * 1024;   // 8MB
const MAX_FILE = 25 * 1024 * 1024; // 25MB — 파일 복사 동기화 상한

const DEVICE = process.platform === "darwin" ? "Mac"
  : process.platform === "win32" ? "Windows" : "Linux";
const TMP_IN = path.join(os.tmpdir(), "pinlog-clip-in.png");
const TMP_OUT = path.join(os.tmpdir(), "pinlog-clip-out.png");

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

/* launchd 등 LANG 없는 환경에서 pbpaste/pbcopy가 한글을 깨뜨리는 것 방지 */
const ENV = { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" };

/* 설정 로드 — 맥에서 설정이 없으면 GUI 대화상자로 물어봄 (pkg 설치 직후 첫 실행) */
function macAsk(msg, hidden) {
  return execFileSync("osascript", ["-e",
    "text returned of (display dialog " + JSON.stringify(msg) +
    ' default answer "" ' + (hidden ? "with hidden answer " : "") +
    'with title "핀로그 클립보드" buttons {"확인"} default button 1)'],
    { encoding: "utf8" }).trim();
}
function macPromptConfig() {
  try {
    const email = macAsk("핀로그 계정 이메일을 입력하세요");
    const password = macAsk("연결 암호를 입력하세요\n(핀로그 → 설정 → 클립보드 → 연결 암호)", true);
    if (!email || !password) throw new Error("empty");
    const c = { email, password, twoWay: true, notify: true };
    fs.writeFileSync(CFG_PATH, JSON.stringify(c, null, 2));
    try { fs.chmodSync(CFG_PATH, 0o600); } catch (e) {}
    return c;
  } catch (e) {
    /* 취소 → 조용히 비활성 (launchd 재시작 루프에서 대화상자 폭탄 방지) */
    try { fs.writeFileSync(CFG_PATH, JSON.stringify({ disabled: true }, null, 2)); } catch (e2) {}
    try {
      execFileSync("osascript", ["-e",
        'display notification "설정이 취소됐어요. 핀로그 클립보드 페이지에서 다시 설치할 수 있어요." with title "핀로그 클립보드"']);
    } catch (e2) {}
    return null;
  }
}

let cfg = null;
try {
  cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
} catch (e) {}
if (cfg && cfg.disabled) { log("비활성 상태 (config disabled)"); process.exit(0); }
if (!cfg || !cfg.email || !cfg.password) {
  if (process.platform === "darwin") cfg = macPromptConfig();
  else {
    console.error("설정 파일이 필요합니다: " + CFG_PATH);
    console.error('내용 예시: { "email": "you@example.com", "password": "****", "twoWay": true }');
    process.exit(1);
  }
  if (!cfg) process.exit(0);
}
const TWO_WAY = cfg.twoWay !== false;
const NOTIFY = cfg.notify !== false;

/* 동기화 확인 알림 */
function notify(msg) {
  if (!NOTIFY) return;
  try {
    if (process.platform === "darwin")
      execFileSync("osascript", ["-e", "display notification " + JSON.stringify(msg) + ' with title "핀로그 클립보드"']);
    else if (process.platform === "win32")
      execFileSync("powershell", ["-NoProfile", "-STA", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;" +
        "$t=New-Object System.Windows.Forms.NotifyIcon; $t.Icon=[System.Drawing.SystemIcons]::Information; $t.Visible=$true;" +
        "$t.BalloonTipTitle='핀로그 클립보드'; $t.BalloonTipText=" + JSON.stringify(msg) + "; $t.ShowBalloonTip(1500); Start-Sleep -m 1800; $t.Dispose()"]);
  } catch (e) {}
}

/* ---------- OS 클립보드: 텍스트 ---------- */
function readText() {
  try {
    if (process.platform === "darwin")
      return execSync("pbpaste", { encoding: "utf8", maxBuffer: 10 << 20, env: ENV });
    if (process.platform === "win32")
      return execSync('powershell -NoProfile -Command "Get-Clipboard -Raw"', { encoding: "utf8", maxBuffer: 10 << 20 });
    return execSync("xclip -o -selection clipboard", { encoding: "utf8", maxBuffer: 10 << 20 });
  } catch (e) { return null; }
}
function writeText(text) {
  try {
    if (process.platform === "darwin") execFileSync("pbcopy", { input: text, env: ENV });
    else if (process.platform === "win32")
      execFileSync("powershell", ["-NoProfile", "-Command", "$input | Set-Clipboard"], { input: text });
    else execFileSync("xclip", ["-i", "-selection", "clipboard"], { input: text });
    return true;
  } catch (e) { return false; }
}

/* ---------- OS 클립보드: 이미지 (PNG) ---------- */
function readImage() {
  try {
    if (process.platform === "darwin") {
      const r = execFileSync("osascript",
        ["-e", "try",
         "-e", "set d to the clipboard as «class PNGf»",
         "-e", `set f to open for access POSIX file "${TMP_IN}" with write permission`,
         "-e", "set eof of f to 0",
         "-e", "write d to f",
         "-e", "close access f",
         "-e", 'return "ok"',
         "-e", "on error",
         "-e", 'return "no"',
         "-e", "end try"],
        { encoding: "utf8" }).trim();
      if (r !== "ok") return null;
    } else if (process.platform === "win32") {
      const r = execFileSync("powershell", ["-NoProfile", "-STA", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;" +
        "if([System.Windows.Forms.Clipboard]::ContainsImage()){" +
        "$i=[System.Windows.Forms.Clipboard]::GetImage();" +
        `$i.Save('${TMP_IN.replace(/\\/g, "\\\\")}',[System.Drawing.Imaging.ImageFormat]::Png);'ok'}else{'no'}`],
        { encoding: "utf8" }).trim();
      if (r !== "ok") return null;
    } else return null;
    const buf = fs.readFileSync(TMP_IN);
    if (!buf.length || buf.length > MAX_IMG) return null;
    return buf;
  } catch (e) { return null; }
}
function writeImage(buf) {
  try {
    fs.writeFileSync(TMP_OUT, buf);
    if (process.platform === "darwin") {
      execFileSync("osascript", ["-e", `set the clipboard to (read (POSIX file "${TMP_OUT}") as «class PNGf»)`]);
    } else if (process.platform === "win32") {
      execFileSync("powershell", ["-NoProfile", "-STA", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;" +
        `$i=[System.Drawing.Image]::FromFile('${TMP_OUT.replace(/\\/g, "\\\\")}');` +
        "[System.Windows.Forms.Clipboard]::SetImage($i); $i.Dispose()"]);
    } else return false;
    return true;
  } catch (e) { return false; }
}
const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/* ---------- OS 클립보드: 파일 (파인더/탐색기에서 ⌘C·Ctrl+C 한 파일들, 최대 10개) ---------- */
const RECV_DIR = path.join(os.tmpdir(), "pinlog-clips");
const MAX_FILES = 10;
function readFilePaths() {
  try {
    let raw = "";
    if (process.platform === "darwin") {
      raw = execFileSync("osascript", ["-l", "JavaScript", "-e",
        'ObjC.import("Cocoa");var pb=$.NSPasteboard.generalPasteboard;var it=pb.pasteboardItems;var r=[];' +
        'if(it){for(var i=0;i<it.count;i++){try{var u=it.objectAtIndex(i).stringForType("public.file-url");' +
        'if(u&&!u.isNil()){var p=$.NSURL.URLWithString(u).path;if(p&&!p.isNil())r.push(ObjC.unwrap(p));}}catch(e){}}}' +
        'r.join("\\n")'],
        { encoding: "utf8", env: ENV }).trim();
    } else if (process.platform === "win32") {
      raw = execFileSync("powershell", ["-NoProfile", "-STA", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms;" +
        "if([System.Windows.Forms.Clipboard]::ContainsFileDropList()){[System.Windows.Forms.Clipboard]::GetFileDropList() -join [char]10}"],
        { encoding: "utf8" }).trim();
    }
    if (!raw) return null;
    const ps = raw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, MAX_FILES)
      .filter((p) => {
        try { const st = fs.statSync(p); return st.isFile() && st.size && st.size <= MAX_FILE; } catch (e) { return false; }
      });
    return ps.length ? ps : null;
  } catch (e) { return null; }
}
function writeFileClip(paths) {
  try {
    if (process.platform === "darwin") {
      execFileSync("osascript", ["-l", "JavaScript", "-e",
        'ObjC.import("Cocoa");function run(argv){var pb=$.NSPasteboard.generalPasteboard;pb.clearContents;' +
        'var urls=argv.map(function(p){return $.NSURL.fileURLWithPath(p);});pb.writeObjects($(urls));return "ok";}',
        ...paths], { env: ENV });
    } else if (process.platform === "win32") {
      execFileSync("powershell", ["-NoProfile", "-STA", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms;" +
        "$sc=New-Object System.Collections.Specialized.StringCollection;" +
        paths.map((p) => "$sc.Add('" + p.replace(/'/g, "''") + "')|Out-Null;").join("") +
        "[System.Windows.Forms.Clipboard]::SetFileDropList($sc)"]);
    } else return false;
    return true;
  } catch (e) { return false; }
}
/* 저장 키는 ASCII로 안전하게 — 실제 파일명은 file_path JSON({p,n})에 보관 */
function safeExt(name) {
  const e = path.extname(name).slice(1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return e && e.length <= 10 ? e : "bin";
}
/* 홈 카드에 뜨는 요약 라벨: "풍경.jpg" / "jpg 5개" / "파일 3개" */
function fileSummary(names) {
  if (names.length === 1) return names[0];
  const exts = [...new Set(names.map(safeExt))];
  return (exts.length === 1 ? exts[0] : "파일") + " " + names.length + "개";
}
/* 파일 묶음 지문 — 순서 무관 (per-file sha1 정렬 후 재해시) */
const combinedHash = (bufs) => sha1(Buffer.from(bufs.map(sha1).sort().join("")));

/* ---------- Supabase ---------- */
let session = null;
async function login() {
  const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("로그인 실패: " + JSON.stringify(j).slice(0, 200));
  session = j;
  log("로그인 완료:", cfg.email, "(" + DEVICE + ")");
}
async function api(pathname, opts = {}, retry = true) {
  const r = await fetch(SUPABASE_URL + pathname, {
    ...opts,
    headers: {
      apikey: ANON_KEY,
      Authorization: "Bearer " + session.access_token,
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401 && retry) { await login(); return api(pathname, opts, false); }
  return r;
}

/* ---------- 동기화 ---------- */
let lastText = null;
let lastImgHash = null;
let lastFileHash = null;
let lastRemoteAt = new Date().toISOString();
let busy = false;   /* 업로드/수신 폴러 직렬화 — 클립보드 쓰기 도중 읽기 방지 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function insertRow(row) {
  const r = await api("/rest/v1/clips", {
    method: "POST",
    headers: { Prefer: "return=representation", "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: session.user.id, ...row, device: DEVICE }),
  });
  if (r.ok) {
    const [saved] = await r.json();
    if (saved) lastRemoteAt = saved.created_at;
    return true;
  }
  log("업로드 실패", r.status);
  return false;
}

async function uploadIfChanged() {
  /* 파일 최우선 — 파인더 파일 복사는 파일명이 텍스트로도 들어오므로 먼저 확인 */
  const fileLocals = readFilePaths();
  if (fileLocals) {
    /* 여러 파일 복사가 진행 중일 수 있음 — 잠깐 뒤 재확인해 안정된 상태만 처리 */
    await sleep(250);
    const again = readFilePaths();
    if (!again || again.join("\n") !== fileLocals.join("\n")) return;
    const bufs = [];
    for (const p of fileLocals) { try { bufs.push(fs.readFileSync(p)); } catch (e) {} }
    if (bufs.length && bufs.length === fileLocals.length) {
      const h = combinedHash(bufs);
      if (h !== lastFileHash) {
        lastFileHash = h;
        const t = readText();
        if (t !== null) lastText = t.slice(0, MAX_TEXT);   // 파일명 텍스트 중복 업로드 방지
        const entries = [];
        for (let i = 0; i < fileLocals.length; i++) {
          const name = path.basename(fileLocals[i]);
          const fp = session.user.id + "/" + Date.now() + "-" + sha1(bufs[i]).slice(0, 8) + "-" + i + "." + safeExt(name);
          const up = await api("/storage/v1/object/clips/" + fp, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: bufs[i],
          });
          if (!up.ok) { log("파일 업로드 실패", up.status); return; }
          entries.push({ p: fp, n: name });
        }
        const label = fileSummary(entries.map((e) => e.n));
        if (await insertRow({ content: label, kind: "file", file_path: JSON.stringify(entries) })) {
          const kb = Math.round(bufs.reduce((s, b) => s + b.length, 0) / 1024);
          log("업로드(파일):", label, kb + "KB");
          notify("복사한 파일을 다른 기기로 보냈어요 ✓ (" + label + ")");
        }
      }
    }
    return;   /* 파일이 클립보드에 있는 동안 파일명 텍스트·이미지는 무시 */
  }
  /* 텍스트 — 텍스트 없이 이미지만 있으면(스크린샷 등) 이미지 */
  const text = readText();
  if (text !== null && text.trim()) {
    const t = text.slice(0, MAX_TEXT);
    if (t !== lastText) {
      lastText = t;
      if (await insertRow({ content: t, kind: "text" })) {
        log("업로드(텍스트):", t.slice(0, 40).replace(/\n/g, " "));
        notify("복사한 내용을 다른 기기로 보냈어요 ✓");
      }
    }
    return;
  }
  const img = readImage();
  if (!img) return;
  const h = sha1(img);
  if (h === lastImgHash) return;
  lastImgHash = h;
  const fp = session.user.id + "/" + Date.now() + "-" + h.slice(0, 8) + ".png";
  const up = await api("/storage/v1/object/clips/" + fp, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: img,
  });
  if (!up.ok) { log("이미지 업로드 실패", up.status); return; }
  if (await insertRow({ content: "[이미지]", kind: "image", file_path: fp })) {
    log("업로드(이미지):", Math.round(img.length / 1024) + "KB");
    notify("복사한 이미지를 다른 기기로 보냈어요 ✓");
  }
}

async function pullRemote() {
  if (!TWO_WAY) return;
  const q = "/rest/v1/clips?select=content,device,created_at,kind,file_path" +
    "&user_id=eq." + session.user.id +
    "&created_at=gt." + encodeURIComponent(lastRemoteAt) +
    "&device=neq." + DEVICE +
    "&order=created_at.desc&limit=1";
  const r = await api(q);
  if (!r.ok) return;
  const rows = await r.json();
  if (!rows.length) return;
  const row = rows[0];
  lastRemoteAt = row.created_at;
  if (row.kind === "file" && row.file_path) {
    /* file_path: JSON [{p,n},...] (신) 또는 단일 스토리지 경로 (구) */
    let entries;
    try { entries = JSON.parse(row.file_path); } catch (e) { entries = null; }
    if (!Array.isArray(entries)) entries = [{ p: row.file_path, n: row.content || "clip.bin" }];
    try {
      fs.mkdirSync(RECV_DIR, { recursive: true });
      const dests = [];
      const bufs = [];
      for (const en of entries.slice(0, MAX_FILES)) {
        const f = await api("/storage/v1/object/clips/" + en.p);
        if (!f.ok) return;
        const buf = Buffer.from(await f.arrayBuffer());
        const name = (en.n || "clip.bin").replace(/[\/\\:]/g, "_");
        const dest = path.join(RECV_DIR, name);
        fs.writeFileSync(dest, buf);
        dests.push(dest);
        bufs.push(buf);
      }
      lastFileHash = combinedHash(bufs);
      let wrote = writeFileClip(dests);
      if (wrote && dests.length > 1) {
        /* 다중 파일 쓰기 검증 — 드물게 일부만 들어가면 1회 재시도 */
        await sleep(300);
        const chk = readFilePaths() || [];
        if (chk.length !== dests.length) wrote = writeFileClip(dests);
      }
      if (wrote) {
        const label = row.content || dests.length + "개";
        log("수신(파일) → 클립보드:", (row.device || "") + " · " + label + " · " + Math.round(bufs.reduce((s, b) => s + b.length, 0) / 1024) + "KB");
        notify((row.device || "다른 기기") + "에서 파일이 도착했어요 — 바로 붙여넣기 하세요 (" + label + ")");
      }
    } catch (e) { log("파일 수신 실패", String(e).slice(0, 80)); }
  } else if (row.kind === "image" && row.file_path) {
    const f = await api("/storage/v1/object/clips/" + row.file_path);
    if (!f.ok) return;
    const buf = Buffer.from(await f.arrayBuffer());
    lastImgHash = sha1(buf);
    if (writeImage(buf)) {
      log("수신(이미지) → 클립보드:", (row.device || "") + " · " + Math.round(buf.length / 1024) + "KB");
      notify((row.device || "다른 기기") + "에서 이미지가 도착했어요 — 바로 붙여넣기 하세요");
    }
  } else {
    lastText = row.content;
    if (writeText(row.content)) {
      log("수신 → 클립보드:", (row.device || "") + " · " + row.content.slice(0, 40).replace(/\n/g, " "));
      notify((row.device || "다른 기기") + "에서 복사한 내용이 도착했어요 — 바로 붙여넣기 하세요");
    }
  }
}

(async () => {
  try {
    await login();
  } catch (e) {
    log(String(e).slice(0, 150));
    if (process.platform === "darwin") {
      try {
        execFileSync("osascript", ["-e",
          'display dialog "로그인에 실패했어요. 이메일·연결 암호를 다시 확인해주세요." with title "핀로그 클립보드" buttons {"다시 입력"} default button 1']);
      } catch (e2) {}
      try { fs.unlinkSync(CFG_PATH); } catch (e2) {}
    }
    process.exit(1);
  }
  const t0 = readText();
  if (t0 !== null) lastText = t0.slice(0, MAX_TEXT);
  const i0 = readImage();
  if (i0) lastImgHash = sha1(i0);
  const f0 = readFilePaths();
  if (f0) { try { lastFileHash = combinedHash(f0.map((p) => fs.readFileSync(p))); } catch (e) {} }
  log("클립보드 감시 시작 — 텍스트·이미지·파일 (양방향: " + (TWO_WAY ? "켬" : "끔") + ")");
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await uploadIfChanged(); } catch (e) { log("err", String(e).slice(0, 120)); }
    busy = false;
  }, POLL_LOCAL_MS);
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await pullRemote(); } catch (e) { log("err", String(e).slice(0, 120)); }
    busy = false;
  }, POLL_REMOTE_MS);
})();
