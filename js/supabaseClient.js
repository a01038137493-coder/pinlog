/*
 * supabaseClient.js
 * ------------------------------------------------------------
 * Supabase 클라이언트 생성 및 인증/프로필 관련 공통 함수.
 * - Supabase client 생성
 * - 현재 로그인 사용자 / 프로필 가져오기
 * - 로그인/권한(role) 확인 후 페이지 접근 제어
 *
 * 주의: 프론트엔드에는 anon public key 만 넣는다.
 *       service_role key 는 절대 넣지 않는다.
 * ------------------------------------------------------------
 */

// 🔑 Supabase 프로젝트 정보 (Settings > API)
// publishable key 는 브라우저에 노출되어도 안전한 공개 키입니다. (service_role 아님)
const SUPABASE_URL = "https://dklpbpldgnwckyfgikdt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TUVifI_U6Ht2PFN6BfOGEw_RDKjmUEE";

/* ============================================================
 * 🧪 목업(데모) 모드 — 실제 백엔드 없이 브라우저에서만 동작
 *   · 기본값 = OFF (실제 Supabase 로그인). 메인 도메인은 진짜 로그인이 필요하다.
 *   · 데모는 /demo.html 로 진입 → 그 "탭 세션"에서만 ON (sessionStorage).
 *     → 데모를 봐도 메인 도메인/다른 탭으로 새어나가지 않음.
 *   · 수동 토글(테스트용): 주소 끝에 ?mock=1 / ?mock=0
 * ============================================================ */
const DT_MOCK_FLAG = "dt_mock_mode";
const DT_MOCK = (function () {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("mock") === "1") sessionStorage.setItem(DT_MOCK_FLAG, "1"); // 이 탭 세션만 ON
    if (q.get("mock") === "0") sessionStorage.removeItem(DT_MOCK_FLAG);   // 끄기
    try { localStorage.removeItem(DT_MOCK_FLAG); } catch (e) {}            // 구버전 영구 플래그 정리(메인 도메인 누수 차단)
    return sessionStorage.getItem(DT_MOCK_FLAG) === "1";
  } catch (e) { return false; }   // 예외 시 안전하게 실제 백엔드
})();
window.DT_MOCK = DT_MOCK;

// 클라이언트 생성: 목업 모드면 가짜 클라이언트, 아니면 실제 Supabase
const supabaseClient = DT_MOCK ? createDtMockClient() : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true },
});

/* 목업 모드 표시 배지 (오른쪽 아래) + 데모 안내 */
if (DT_MOCK) {
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("dt-mock-badge")) return;
    const b = document.createElement("div");
    b.id = "dt-mock-badge";
    b.textContent = "🧪 목업 모드";
    b.title = "데모(목업) 모드입니다. 끄려면 주소 끝에 ?mock=0 을 붙이세요.";
    b.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:9999;background:#1b1b1b;color:#fff;" +
      "font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;opacity:.78;" +
      "font-family:system-ui,-apple-system,sans-serif;pointer-events:none;letter-spacing:.02em;";
    document.body.appendChild(b);
  });

  /* 데모(목업) 모드: '로그아웃'은 의미가 없고 누르면 로그인 화면에 갇히므로
     '데모 처음부터'(깨끗한 상태로 리셋)로 바꿔 /demo.html 로 보낸다. → 데모 동선에서 로그인 화면 제거 */
  document.addEventListener("DOMContentLoaded", function () {
    var isAdminView = /admin|student-detail/.test(location.pathname);
    document.querySelectorAll('[onclick*="logout"]').forEach(function (btn) {
      btn.textContent = "데모 처음부터";
      btn.removeAttribute("onclick");
      btn.addEventListener("click", function () {
        location.href = isAdminView ? "/demo.html?role=admin" : "/demo.html";
      });
    });
  });
}

/* ============================================================
 * 가짜 Supabase 클라이언트 (목업 전용)
 *   - 앱이 쓰는 메서드만 흉내냄: from().select/insert/update/upsert/eq/gte/order/limit/single/maybeSingle
 *   - auth: signInWithPassword / getUser / getSession / signOut
 *   - 데이터는 localStorage 에 저장, 최초 1회 데모 데이터 시드
 * ============================================================ */
function createDtMockClient() {
  const DB_KEY = "dt_mock_db";
  const SESSION_KEY = "dt_mock_session";
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

  // 날짜 헬퍼 (utils.js 와 동일 규칙: 오늘=YYYY-MM-DD, 주 시작=월요일)
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = (str, n) => { const d = new Date(str); d.setDate(d.getDate() + n); return ymd(d); };
  const weekStart = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return ymd(d); };

  function seed() {
    const SUBJECTS = ["korean", "math", "english", "inquiry1", "inquiry2"];
    const profiles = [
      { id: "demo-student-1", role: "student", name: "김민준", email: "student@demo.com",
        seat_number: "A-01", target_university: "서울대학교", target_major: "컴퓨터공학과",
        target_score: "1등급", management_level: "intensive", status: "active",
        // 데모 기본 위젯 배치 (홈페이지 데모용 — 사용자가 직접 구성한 레이아웃을 기본값으로 고정)
        dashboard_layout: {"v":3,"removed":[],"extra":["timer","clock","weather","memo","tasks"],"layouts":{"c13":{"calendar":{"c":10,"r":1,"p":1},"timer":{"c":3,"r":1,"p":1},"clock":{"c":12,"r":1,"p":1},"weather":{"c":3,"r":3,"p":1},"memo":{"c":10,"r":3,"p":1},"tasks":{"c":1,"r":1,"p":1}}},"theme":"default","memo":{"text":"","font":"default"},"motto":{"text":""},"clock":{"design":"digital"}} },
      { id: "demo-student-2", role: "student", name: "이서연", email: "student2@demo.com",
        seat_number: "B-04", target_university: "연세대학교", target_major: "경영학과",
        target_score: "2등급", management_level: "basic", status: "active", dashboard_layout: null },
      { id: "demo-admin", role: "admin", name: "박원장", email: "admin@demo.com",
        seat_number: null, target_university: null, target_major: null, target_score: null,
        management_level: "basic", status: "active", dashboard_layout: null },
    ];

    const TASK_POOL = [
      { subject: "math", text: "수학 미적분 기출 3개년", subs: ["2024 9월", "2023 수능", "오답 정리"] },
      { subject: "korean", text: "국어 비문학 지문 6개", subs: ["과학 2지문", "경제 2지문", "철학 2지문"] },
      { subject: "english", text: "영어 단어 DAY 12 + 듣기", subs: ["단어 50개", "듣기 1회분"] },
      { subject: "inquiry1", text: "생명과학 유전 단원 복습", subs: [] },
      { subject: "math", text: "수학 확통 문제집 p.40~52", subs: [] },
    ];

    const checkins = [], checkouts = [];
    const mkRow = (sid, dateStr, i, withCheckout) => {
      const ntasks = 2 + (i % 2);
      const tasks = [];
      for (let k = 0; k < ntasks; k++) {
        const t = TASK_POOL[(i + k) % TASK_POOL.length];
        tasks.push({ subject: t.subject, text: t.text, subtasks: t.subs.map((s) => ({ text: s })) });
      }
      const plannedTotal = 8 + (i % 3);
      const ci = {
        id: `ci-${sid}-${dateStr}`, student_id: sid, date: dateStr,
        planned_total_hours: plannedTotal, tasks: tasks,
        task_1: tasks[0] ? tasks[0].text : null,
        task_2: tasks[1] ? tasks[1].text : null,
        task_3: tasks[2] ? tasks[2].text : null,
        risk_today: i % 4 === 0 ? "오후 졸림 주의" : null,
        condition_score: 3 + (i % 3), plan_quality_score: 70 + (i % 25),
      };
      SUBJECTS.forEach((s, si) => { ci[`planned_${s}_hours`] = si < 3 ? 2 : 1; });
      checkins.push(ci);
      if (!withCheckout) return;
      const results = tasks.map((_, k) => ({ status: ["completed", "completed", "partial", "missed"][(i + k) % 4] }));
      const done = results.filter((r) => r.status === "completed").length;
      const rate = Math.round((done / tasks.length) * 100);
      const co = {
        id: `co-${sid}-${dateStr}`, student_id: sid, date: dateStr,
        task_results: results,
        task_1_status: results[0] ? results[0].status : null,
        task_2_status: results[1] ? results[1].status : null,
        task_3_status: results[2] ? results[2].status : null,
        task_1_done: !!(results[0] && results[0].status === "completed"),
        task_2_done: !!(results[1] && results[1].status === "completed"),
        task_3_done: !!(results[2] && results[2].status === "completed"),
        task_completion_rate: rate, achievement_rate: rate,
        actual_total_hours: Math.max(2, plannedTotal - (i % 4)),
        failure_reason: rate < 60 ? "계획보다 집중력이 떨어졌어요" : null,
        carryover_tasks: tasks.filter((_, k) => results[k] && results[k].status !== "completed").map((t) => t.text),
        self_score: 3 + (i % 3),
        reflection: i % 3 === 0 ? "오늘은 수학에 집중이 잘 됐다. 내일은 국어 비중을 늘리자." : null,
      };
      SUBJECTS.forEach((s, si) => { co[`actual_${s}_hours`] = si < 3 ? 2 : 1; });
      checkouts.push(co);
    };
    for (let i = 10; i >= 1; i--) mkRow("demo-student-1", addDays(today(), -i), i, true);
    mkRow("demo-student-1", today(), 0, false);   // 오늘은 체크인만 → 체크아웃 흐름 체험용
    for (let i = 6; i >= 0; i--) mkRow("demo-student-2", addDays(today(), -i), i, i !== 0);

    const ws = weekStart();
    const weekly_goals = [
      { id: "wg-1", student_id: "demo-student-1", week_start_date: ws, total_study_hour_goal: 60,
        korean_hour_goal: 14, math_hour_goal: 18, english_hour_goal: 12, inquiry1_hour_goal: 8, inquiry2_hour_goal: 8,
        core_goal_1: "수학 미적분 기출 3개년 완성", core_goal_2: "국어 비문학 매일 6지문", core_goal_3: "영어 단어 1바퀴",
        weak_point: "수학 킬러 문항", life_goal: "취침 12시 전", risk_factor: "주말 늦잠" },
      { id: "wg-2", student_id: "demo-student-2", week_start_date: ws, total_study_hour_goal: 45,
        korean_hour_goal: 12, math_hour_goal: 12, english_hour_goal: 10, inquiry1_hour_goal: 6, inquiry2_hour_goal: 5,
        core_goal_1: "경영 논술 주 2회", core_goal_2: "영어 모의고사 2회",
        weak_point: "영어 빈칸 추론", life_goal: "주 3회 운동", risk_factor: "휴대폰 사용" },
    ];
    const weekly_reviews = [
      { id: "wr-1", student_id: "demo-student-1", week_start_date: addDays(ws, -7),
        actual_total_hours: 52, achievement_rate: 87, task_completion_rate: 87,
        biggest_success: "수학 기출 목표 달성", biggest_delay: "탐구 복습 미흡",
        repeated_failure_reason: "오후 집중력 저하", next_week_adjustment: "어려운 과목 오전 배치", needs_consulting: false },
      { id: "wr-2", student_id: "demo-student-2", week_start_date: addDays(ws, -7),
        actual_total_hours: 31, achievement_rate: 54, task_completion_rate: 54,
        biggest_success: "영어 모의 1회 완료", biggest_delay: "전반적 시간 부족",
        repeated_failure_reason: "휴대폰 사용", next_week_adjustment: "폰 사물함 보관", needs_consulting: true },
    ];
    const interventions = [
      { id: "iv-1", student_id: "demo-student-2", counselor_id: "demo-admin", date: addDays(today(), -2),
        trigger_reason: "주간 달성률 54%", action_type: "면담", note: "휴대폰 사용 습관 점검. 사물함 보관 합의.", followup_date: addDays(today(), 5) },
    ];
    return { profiles, daily_checkins: checkins, daily_checkouts: checkouts, weekly_goals, weekly_reviews, interventions };
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
  if (!db || !db.profiles) { db = seed(); }
  function persist() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {} }
  persist();

  function Query(table) {
    this.table = table; this.mode = "select";
    this.filters = []; this.orderBy = null; this.limitN = null;
    this.payload = null; this.conflict = null; this.one = null;
  }
  Query.prototype.select = function () { return this; };
  Query.prototype.insert = function (rows) { this.mode = "insert"; this.payload = rows; return this; };
  Query.prototype.update = function (obj) { this.mode = "update"; this.payload = obj; return this; };
  Query.prototype.upsert = function (rows, opts) { this.mode = "upsert"; this.payload = rows; this.conflict = (opts && opts.onConflict) || null; return this; };
  Query.prototype.eq = function (col, val) { this.filters.push(["eq", col, val]); return this; };
  Query.prototype.gte = function (col, val) { this.filters.push(["gte", col, val]); return this; };
  Query.prototype.order = function (col, opts) { this.orderBy = { col: col, asc: !opts || opts.ascending !== false }; return this; };
  Query.prototype.limit = function (n) { this.limitN = n; return this; };
  Query.prototype.single = function () { this.one = "single"; return this; };
  Query.prototype.maybeSingle = function () { this.one = "maybe"; return this; };
  Query.prototype._match = function (row) {
    return this.filters.every(function (f) {
      if (f[0] === "eq") return row[f[1]] === f[2];
      if (f[0] === "gte") return String(row[f[1]]) >= String(f[2]);
      return true;
    });
  };
  Query.prototype._key = function (row, keys) { return keys.map(function (k) { return row[k]; }).join(""); };
  Query.prototype._run = function () {
    const arr = (db[this.table] = db[this.table] || []);
    if (this.mode === "insert" || this.mode === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keys = this.conflict ? this.conflict.split(",").map(function (s) { return s.trim(); }) : null;
      const out = [];
      for (const r of rows) {
        let rec = null;
        if (this.mode === "upsert" && keys) {
          const k = this._key(r, keys);
          const idx = arr.findIndex((x) => this._key(x, keys) === k);
          if (idx >= 0) rec = Object.assign(arr[idx], clone(r));
        }
        if (!rec) { rec = clone(r); if (!rec.id) rec.id = `${this.table}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; arr.push(rec); }
        out.push(rec);
      }
      persist();
      return { data: clone(out), error: null };
    }
    if (this.mode === "update") {
      const upd = [];
      for (const row of arr) if (this._match(row)) { Object.assign(row, clone(this.payload)); upd.push(row); }
      persist();
      return { data: clone(upd), error: null };
    }
    let rows = arr.filter((r) => this._match(r));
    if (this.orderBy) {
      const col = this.orderBy.col, sign = this.orderBy.asc ? 1 : -1;
      rows = rows.slice().sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * sign);
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.one) return { data: rows.length ? clone(rows[0]) : null, error: null };
    return { data: clone(rows), error: null };
  };
  Query.prototype.then = function (onF, onR) { return Promise.resolve().then(() => this._run()).then(onF, onR); };

  return {
    from: function (table) { return new Query(table); },
    auth: {
      signInWithPassword: async function (creds) {
        const email = (creds && creds.email) || "";
        const u = db.profiles.find((p) => p.email && p.email.toLowerCase() === String(email).toLowerCase());
        if (!u) return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        localStorage.setItem(SESSION_KEY, u.id);
        return { data: { user: { id: u.id, email: u.email }, session: { user: { id: u.id } } }, error: null };
      },
      getUser: async function () {
        const id = localStorage.getItem(SESSION_KEY);
        const u = id && db.profiles.find((p) => p.id === id);
        if (!u) return { data: { user: null }, error: { message: "Auth session missing" } };
        return { data: { user: { id: u.id, email: u.email } }, error: null };
      },
      getSession: async function () {
        const id = localStorage.getItem(SESSION_KEY);
        return { data: { session: id ? { user: { id: id } } : null }, error: null };
      },
      signOut: async function () { localStorage.removeItem(SESSION_KEY); return { error: null }; },
    },
  };
}

/* 아직 Supabase 키를 채우지 않았는지 확인 (최초 설정 안내용) */
function isSupabaseConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_SUPABASE_URL") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

/* 현재 로그인한 사용자(auth user) 가져오기 */
async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/* 현재 로그인한 사용자의 profiles 레코드 가져오기
 * 로딩 단축: 로컬 캐시가 있으면 즉시 반환하고 백그라운드에서 갱신한다.
 * 라우팅에 영향 주는 값(user_type/role/onboarded)이 바뀌었으면 새로고침으로 자가 치유. */
const DT_PROFILE_CACHE = "dt_profile_cache";

async function dtFetchProfile(id) {
  const { data, error } = await supabaseClient
    .from("profiles").select("*").eq("id", id).single();
  return error ? null : data;
}

async function getCurrentProfile() {
  // 세션은 로컬 저장소에서 즉시 확인 (네트워크 왕복 없음)
  let user = null;
  try {
    const { data } = await supabaseClient.auth.getSession();
    user = (data && data.session && data.session.user) || null;
  } catch (e) {}
  if (!user) user = await getCurrentUser();
  if (!user) return null;

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(DT_PROFILE_CACHE) || "null"); } catch (e) {}
  if (cached && cached.id === user.id) {
    dtFetchProfile(user.id).then((fresh) => {          // 백그라운드 갱신
      if (!fresh) return;
      localStorage.setItem(DT_PROFILE_CACHE, JSON.stringify(fresh));
      if (fresh.user_type !== cached.user_type || fresh.role !== cached.role ||
          fresh.onboarded !== cached.onboarded) window.location.reload();
    });
    return cached;
  }

  const fresh = await dtFetchProfile(user.id);
  if (fresh) localStorage.setItem(DT_PROFILE_CACHE, JSON.stringify(fresh));
  return fresh;
}

/* 로그인 안 되어 있으면 로그인 페이지로 보냄 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    // 로그인 후 원래 보던 페이지로 복귀할 수 있게 next 전달
    const here = window.location.pathname + window.location.search;
    window.location.href = "/login.html?next=" + encodeURIComponent(here);
    return null;
  }
  return user;
}

/* allowedRoles 에 포함된 role 만 접근 허용. 아니면 적절한 페이지로 리다이렉트 */
async function requireRole(allowedRoles) {
  const profile = await getCurrentProfile();
  if (!profile) {
    window.location.href = "/login.html";
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    if (profile.role === "student") window.location.href = "/student.html";
    else window.location.href = "/admin.html";
    return null;
  }

  return profile;
}

/* 로그아웃 후 웰컴(첫 화면)으로 이동 */
async function logout() {
  localStorage.removeItem(DT_PROFILE_CACHE);
  await supabaseClient.auth.signOut();
  window.location.href = "/welcome.html";
}

/* ============================================================
 * 계정 삭제 (회원 탈퇴)
 *   - 앱스토어 가이드라인 5.1.1(v): 계정 생성이 가능한 앱은
 *     앱 안에서 계정 삭제도 가능해야 한다.
 *   - sql/11_account_deletion.sql 의 delete_my_account RPC 호출
 *   - auth.users 행이 지워지면 모든 기록이 cascade 삭제됨
 * ============================================================ */
async function deleteMyAccount() {
  if (window.DT_MOCK) {
    alert("데모 모드에서는 계정 삭제가 지원되지 않습니다.");
    return;
  }

  const first = confirm(
    "계정을 삭제하면 모든 공부 기록이 영구히 사라지며 복구할 수 없습니다.\n정말 삭제하시겠어요?"
  );
  if (!first) return;

  const second = confirm("마지막 확인입니다. 지금 계정을 완전히 삭제할까요?");
  if (!second) return;

  // 업로드한 파일 먼저 정리 (storage 테이블은 SQL 로 직접 지울 수 없어 앱에서 처리)
  try {
    const user = await getCurrentUser();
    if (user) {
      const { data: rows } = await supabaseClient
        .from("files").select("path").eq("student_id", user.id);
      const paths = (rows || []).map((r) => r.path).filter(Boolean);
      if (paths.length) await supabaseClient.storage.from("memo-files").remove(paths);
    }
  } catch (e) {
    /* 파일 정리 실패해도 계정 삭제는 진행 */
  }

  const { error } = await supabaseClient.rpc("delete_my_account");
  if (error) {
    alert("계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  localStorage.removeItem(DT_PROFILE_CACHE);
  await supabaseClient.auth.signOut();
  alert("계정이 삭제되었습니다. 이용해주셔서 감사합니다.");
  window.location.replace("/welcome.html");
}

/* ============================================================
 * 소셜 로그인 (카카오 / 구글)
 *   - Supabase OAuth 로 이동 → 완료 후 /index.html 로 복귀
 *     (index.html 이 세션을 읽고 role 에 맞는 페이지로 분기)
 *   - 첫 로그인 시 profiles 행은 DB 트리거가 자동 생성
 *     (sql/10_b2c_signup.sql)
 * ============================================================ */
async function signInWithProvider(provider) {
  const box =
    document.getElementById("login-error") ||
    document.getElementById("signup-error");
  const fail = (e) => {
    if (!box) return;
    const msg = String((e && e.message) || "");
    box.textContent = /not enabled|unsupported provider/i.test(msg)
      ? "아직 준비 중인 로그인 방식이에요. 조금만 기다려주세요."
      : "소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.";
  };

  if (window.DT_MOCK) {
    if (box) box.textContent = "데모 모드에서는 소셜 로그인이 지원되지 않습니다.";
    return;
  }

  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  try {
    if (provider === "apple" && isNative) {
      // 네이티브 Apple 로그인 → id_token 을 Supabase 에 전달 (심사 필수 기능)
      const { SignInWithApple } = window.Capacitor.Plugins;
      const res = await SignInWithApple.authorize({
        clientId: "com.pinlog.app",
        redirectURI: "https://studylog-five.vercel.app/auth-return.html",
        scopes: "name email",
      });
      const idToken = res && res.response && res.response.identityToken;
      if (!idToken) throw new Error("apple-cancelled");
      const { error } = await supabaseClient.auth.signInWithIdToken({ provider: "apple", token: idToken });
      if (error) throw error;
      window.location.href = "/index.html";
      return;
    }
    if (isNative) {
      // 앱: 임베디드 웹뷰 OAuth 는 구글이 차단 → 시스템 브라우저에서 진행 후
      //     dittonlog://auth-callback 딥링크로 복귀 (아래 appUrlOpen 리스너)
      // 커스텀 스킴 직행은 카카오톡 앱 전환 시 다른 브라우저에서 끝나며 끊길 수 있어
      // HTTPS 복귀 페이지(auth-return.html)를 경유해 딥링크로 앱에 code 를 전달한다.
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: "https://studylog-five.vercel.app/auth-return.html", skipBrowserRedirect: true },
      });
      if (error) throw error;
      await window.Capacitor.Plugins.Browser.open({ url: data.url });
    } else {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
    }
  } catch (e) { fail(e); }
}

/* 딥링크 복귀: dittonlog://auth-callback?code=... → 세션 교환 → 홈 분기 */
(function wireOAuthDeepLink() {
  if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
  const AppPlugin = window.Capacitor.Plugins.App;
  if (!AppPlugin) return;
  AppPlugin.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith("dittonlog://auth-callback")) return;
    try { await window.Capacitor.Plugins.Browser.close(); } catch (e) {}
    let code = null;
    try { code = new URL(url.replace("dittonlog://", "https://dt/")).searchParams.get("code"); } catch (e) {}
    if (!code) return;
    const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (!error) window.location.href = "/index.html";
  });
})();
