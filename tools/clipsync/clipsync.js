#!/usr/bin/env node
/*
 * 핀로그 클립싱크 에이전트 (macOS / Windows / Linux, Node 18+)
 * ------------------------------------------------------------
 * 백그라운드에서 OS 클립보드를 감시해 변경되면 핀로그(clips)로 업로드하고,
 * 다른 기기에서 올라온 새 클립은 이 기기의 클립보드에 자동으로 넣어준다.
 * → 맥북에서 ⌘C 하면 윈도우에서 바로 Ctrl+V.
 *
 * 설정: ~/.pinlog-clipsync.json  { "email": "...", "password": "...", "twoWay": true }
 * 실행: node clipsync.js   (launchd/작업 스케줄러로 상시 실행 권장 — README 참고)
 */

const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SUPABASE_URL = "https://dklpbpldgnwckyfgikdt.supabase.co";
const ANON_KEY = "sb_publishable_TUVifI_U6Ht2PFN6BfOGEw_RDKjmUEE";
const CFG_PATH = path.join(os.homedir(), ".pinlog-clipsync.json");
const POLL_LOCAL_MS = 1200;    // 로컬 클립보드 감시 주기
const POLL_REMOTE_MS = 2500;   // 원격 새 클립 확인 주기
const MAX_LEN = 10000;

const DEVICE = process.platform === "darwin" ? "Mac"
  : process.platform === "win32" ? "Windows" : "Linux";

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
  if (!cfg.email || !cfg.password) throw new Error("email/password 누락");
} catch (e) {
  console.error("설정 파일이 필요합니다: " + CFG_PATH);
  console.error('내용 예시: { "email": "you@example.com", "password": "****", "twoWay": true }');
  process.exit(1);
}
const TWO_WAY = cfg.twoWay !== false;

/* ---------- OS 클립보드 ---------- */
function readClip() {
  try {
    if (process.platform === "darwin")
      return execSync("pbpaste", { encoding: "utf8", maxBuffer: 10 << 20 });
    if (process.platform === "win32")
      return execSync('powershell -NoProfile -Command "Get-Clipboard -Raw"', { encoding: "utf8", maxBuffer: 10 << 20 });
    return execSync("xclip -o -selection clipboard", { encoding: "utf8", maxBuffer: 10 << 20 });
  } catch (e) { return null; }   // 이미지 등 텍스트가 아니면 실패 — 무시
}
function writeClip(text) {
  try {
    if (process.platform === "darwin")
      execFileSync("pbcopy", { input: text });
    else if (process.platform === "win32")
      execFileSync("powershell", ["-NoProfile", "-Command", "$input | Set-Clipboard"], { input: text });
    else
      execFileSync("xclip", ["-i", "-selection", "clipboard"], { input: text });
    return true;
  } catch (e) { return false; }
}

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
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401 && retry) { await login(); return api(pathname, opts, false); }
  return r;
}

/* ---------- 동기화 루프 ---------- */
let lastLocal = null;      // 마지막으로 본 로컬 클립보드
let lastRemoteAt = new Date().toISOString();

async function uploadIfChanged() {
  const raw = readClip();
  if (raw === null) return;
  const text = raw.slice(0, MAX_LEN);
  if (!text.trim() || text === lastLocal) return;
  lastLocal = text;
  const r = await api("/rest/v1/clips", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: session.user.id, content: text, device: DEVICE }),
  });
  if (r.ok) {
    const [row] = await r.json();
    if (row) lastRemoteAt = row.created_at;
    log("업로드:", text.slice(0, 40).replace(/\n/g, " ") + (text.length > 40 ? "…" : ""));
  } else {
    log("업로드 실패", r.status);
  }
}

async function pullRemote() {
  if (!TWO_WAY) return;
  const q = "/rest/v1/clips?select=content,device,created_at" +
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
  lastLocal = row.content;               // 되돌려 업로드하지 않게
  if (writeClip(row.content))
    log("수신 → 클립보드:", (row.device || "") + " · " + row.content.slice(0, 40).replace(/\n/g, " "));
}

(async () => {
  await login();
  const first = readClip();
  if (first !== null) lastLocal = first;   // 시작 시 기존 내용은 업로드하지 않음
  log("클립보드 감시 시작 (양방향: " + (TWO_WAY ? "켬" : "끔") + ")");
  setInterval(() => uploadIfChanged().catch((e) => log("err", String(e).slice(0, 120))), POLL_LOCAL_MS);
  setInterval(() => pullRemote().catch((e) => log("err", String(e).slice(0, 120))), POLL_REMOTE_MS);
})();
