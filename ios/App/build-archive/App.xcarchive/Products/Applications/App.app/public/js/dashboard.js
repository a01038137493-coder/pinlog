/*
 * dashboard.js
 * ------------------------------------------------------------
 * 학생 대시보드 위젯 커스터마이징 (아이폰 홈 화면식 + 자유 배치 격자).
 * - core 위젯(학생카드+체크인/체크아웃+목표/회고/기록)은 위에 풀폭 고정: 안 흔들리고 삭제 불가
 * - 그 아래 "캔버스(격자)": 달력(내장) + 추가형 위젯을 원하는 칸에 자유 배치
 *   · 위젯을 길게 누르면(롱프레스) 편집 모드 → 위젯 흔들흔들
 *   · 편집 모드에서 위젯을 끌어 원하는 칸으로 이동(빈 칸 허용, 가장 가까운 빈 칸에 스냅)
 *   · 오른쪽 위 X(−)로 삭제, "+ 위젯 추가"로 복구
 * - 저장: Supabase profiles.dashboard_layout (없으면 localStorage 폴백)
 *   형태: { v:3, removed:["calendar"], extra:["plant"], layouts:{ "c2":{id:{c,r,p}}, "c9":{...} } }
 *   · layouts 는 화면 "열 수"(c2=폰 2칸, c9=PC 9칸 등)별로 위젯 배치를 따로 보관 →
 *     기기/화면을 바꿔도 서로의 배치를 덮어쓰지 않음. (c,r=격자 좌표 1-base, p=페이지 1~3)
 * ------------------------------------------------------------
 */

const GAP = 12;        // 격자 간격(px) — CSS .widget-canvas gap 과 동일
const CELL_W = 118;    // 한 칸 너비(px) — 달력 2칸 = 248px(원본 크기)
const CELL_H = 122;    // 한 칸 높이(px) — CSS grid-auto-rows 와 동일
const CORE_COLS = 5;   // 메인카드(core) 기본 너비(칸 수)
let coreFp = { c: 1, r: 1, w: CORE_COLS, h: 4 };  // core가 차지하는 칸(렌더 시 계산)

const WIDGET_CATALOG = {
  calendar: { emoji: "📅", title: "달력",       desc: "이번 달 미니 달력",       builtin: true, w: 2, h: 2 },
  timer:    { emoji: "⏱️", title: "공부 타이머", desc: "집중 시간 카운트다운 (5·25·50분)",      w: 2, h: 2 },
  clock:    { emoji: "🕐", title: "시계",       desc: "현재 시각",               w: 2, h: 2 },
  weather:  { emoji: "🌤️", title: "날씨",       desc: "오늘의 날씨와 기온",   w: 2, h: 2 },
  tasks:    { emoji: "✅", title: "오늘 과제",   desc: "지금 할 일 · 완료 체크",  w: 2, h: 2 },
  memo:     { emoji: "📝", title: "메모장",     desc: "자유 메모 (폰트 선택 가능)", w: 2, h: 2 },
  motto:    { emoji: "🔥", title: "한줄 다짐",   desc: "오늘의 한 줄 선언 (가로 배너)", w: 4, h: 1 },
};

let dashProfile = null;
let dashLayout = { v: 3, removed: [], extra: [], pos: {} };
let editMode = false;

async function initDashboard(profile) {
  dashProfile = profile;
  const loaded = await loadLayout(profile.id);
  dashLayout = normalizeLayout(loaded);
  if (loaded == null) dashLayout.extra = ["timer"]; // 최초 진입 기본 위젯
  wireCalendarDelete();
  renderCanvas();
  setupLongPress();
  setupDrag();
  setupPager();
  setupEditEntry();        // 상단 "편집" 버튼(원탭 진입) — 롱프레스 어색함 보완
  setupCoreAutoReflow();   // 코어 카드 높이 변동 시 아래 위젯 자동 재배치(겹침/흐트러짐 방지)
  // 프로필 로드 전(첫 페인트)에 만들어진 과제 위젯은 로드가 실패한 채 방치될 수 있다 → 여기서 다시 로드
  const tasksEl = document.querySelector(".widget--tasks");
  if (tasksEl && tasksWidget.tasks == null) { renderTasksWidget(tasksEl); loadTodayTasks(tasksEl); }
  window.addEventListener("resize", renderCanvas);
  // 웹폰트가 늦게 로드되면 코어 높이가 미세하게 달라지므로, 로드 후 한 번 더 정렬 보정
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderCanvas());
}

/* 상단 "편집" 버튼: 원탭으로 편집 모드 토글. 진입 즉시 첫 터치부터 드래그 가능. */
function setupEditEntry() {
  const right = document.querySelector(".topbar__right");
  if (!right || document.getElementById("edit-enter")) return;
  const btn = document.createElement("button");
  btn.id = "edit-enter";
  btn.type = "button";
  btn.className = "btn btn--ghost btn--sm";
  btn.textContent = "편집";
  btn.addEventListener("click", () => { editMode ? exitEditMode() : enterEditMode(); });
  right.insertBefore(btn, right.firstChild);
}

/* 코어 카드(이름·결과·오늘 과제 등) 높이가 바뀌면 아래 위젯들을 다시 배치해 겹침 방지.
 * - "오늘 과제" 탭/스와이프, 결과 스트립 표시, 웹폰트 로드 등으로 높이가 변할 때 대응
 * - renderCanvas 는 관측 대상의 높이를 바꾸지 않으므로 무한 루프 없음 (rAF 로 1회 디바운스) */
let coreReflowRaf = null;
function setupCoreAutoReflow() {
  if (typeof ResizeObserver === "undefined") return;
  const targets = [
    document.querySelector(".widget--core .status-card"),
    document.querySelector(".widget--core .home-grid"),
  ].filter(Boolean);
  if (!targets.length) return;
  const ro = new ResizeObserver(() => {
    if (coreReflowRaf) return;
    coreReflowRaf = requestAnimationFrame(() => { coreReflowRaf = null; renderCanvas(); });
  });
  targets.forEach((t) => ro.observe(t));
}

/* ============================================================
 * 페이지 슬라이드 (스크롤 스냅) + 하단 점 인디케이터
 * ============================================================ */
function setupPager() {
  const pager = document.getElementById("pager");
  const dots = document.getElementById("pager-dots");
  if (!pager || pager.dataset.wired) return;
  pager.dataset.wired = "1";

  const setActive = (p) => {
    currentPage = Math.min(PAGE_COUNT, Math.max(1, p));
    if (dots) dots.querySelectorAll(".pager-dot").forEach((d) =>
      d.classList.toggle("is-active", Number(d.dataset.page) === currentPage));
  };

  // 점 클릭 → 해당 페이지로 스크롤
  if (dots) dots.querySelectorAll(".pager-dot").forEach((d) =>
    d.addEventListener("click", () => {
      pager.scrollTo({ left: pager.clientWidth * (Number(d.dataset.page) - 1), behavior: "smooth" });
    }));

  // 스크롤(스와이프) → 현재 페이지/점 갱신
  let raf = null;
  pager.addEventListener("scroll", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const p = Math.round(pager.scrollLeft / pager.clientWidth) + 1;
      if (p !== currentPage) setActive(p);
    });
  });
}

function normalizeLayout(l) {
  return {
    v: 3,
    removed: l && Array.isArray(l.removed) ? l.removed : [],
    extra: l && Array.isArray(l.extra) ? l.extra : [],
    // 위젯 위치는 화면 "열 수"별로 따로 저장한다. (폰=2칸, 태블릿/PC=여러 칸)
    // 같은 절대좌표를 모든 기기가 공유하면 기기를 바꿀 때 배치가 흐트러지므로 분리한다.
    layouts: l && l.layouts && typeof l.layouts === "object" ? l.layouts : {},
    // renderCanvas가 현재 화면 열 수에 맞는 배치(layouts[열수])로 교체할 작업용 참조
    pos: {},
    // 구버전(단일 배치)에서 올라온 경우: 처음 만나는 화면에 1회만 이식
    _seedPos: l && !l.layouts && l.pos && typeof l.pos === "object" ? l.pos : null,
    memo: {
      text: l && l.memo && typeof l.memo.text === "string" ? l.memo.text : "",
      font: l && l.memo && typeof l.memo.font === "string" ? l.memo.font : "default",
    },
    motto: {
      text: l && l.motto && typeof l.motto.text === "string" ? l.motto.text : "",
    },
    clock: {
      design: l && l.clock && l.clock.design === "analog" ? "analog" : "digital",
    },
    // 날씨 지역 선택 (null = 자동 추정)
    weather: l && l.weather && typeof l.weather.lat === "number" ? l.weather : null,
  };
}

/* ============================================================
 * 저장/불러오기 (Supabase 우선 + localStorage 폴백)
 * ============================================================ */
function layoutKey(id) { return `dt_dashboard_${id}`; }

let layoutLoadFailed = false;   // 서버에서 확답을 못 받은 상태 — 자동 저장으로 덮어쓰지 않는다

async function loadLayout(id) {
  // 앱 재실행 직후엔 세션 복원 전이라 RLS 로 빈 결과가 올 수 있다.
  // 그 순간을 "저장된 배치 없음"으로 오인하면 기본 배치로 초기화돼 보이므로 재시도한다.
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles").select("dashboard_layout").eq("id", id).maybeSingle();
      if (!error && data) return data.dashboard_layout || null;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 700));
  }
  layoutLoadFailed = true;
  try {
    const raw = localStorage.getItem(layoutKey(id));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

async function saveLayout() {
  // 저장 시엔 작업용 임시 필드(pos/_seedPos)를 빼고 화면 폭별 배치(layouts)만 남긴다
  const payload = { ...dashLayout };
  delete payload.pos;
  delete payload._seedPos;
  try {
    localStorage.setItem(layoutKey(dashProfile.id), JSON.stringify(payload));
    localStorage.setItem("dt_dashboard_lastid", dashProfile.id); // 다음 방문 첫 페인트 복원용
  } catch (e) {}
  try {
    await supabaseClient.from("profiles")
      .update({ dashboard_layout: payload }).eq("id", dashProfile.id);
  } catch (e) {}
}

/* ============================================================
 * 격자 계산
 * ============================================================ */
function colsNow() {
  const canvas = document.getElementById("widget-canvas");
  const w = canvas ? canvas.clientWidth : window.innerWidth;
  let n = Math.max(2, Math.floor((w + GAP) / (CELL_W + GAP)));
  // 코어 카드(5칸)가 정확히 가운데 오도록 양옆 열 수를 짝수로 맞춘다.
  // (예: 10열이면 좌2/우3으로 코어가 비껴 보임 → 9열로 줄여 좌2/우2 대칭)
  if (n > CORE_COLS && (n - CORE_COLS) % 2 === 1) n -= 1;
  return n;
}

/* 현재 화면 "열 수"에 맞는 위젯 배치 맵을 활성화 (기기/화면 폭별 분리 저장)
 * - 폰(2칸)과 PC(여러 칸)가 각자의 배치를 따로 기억 → 기기를 오가도 서로 덮어쓰지 않음 */
let pendingLayoutSave = false;   // 처음 보는 화면 폭 → 자동 배치 결과를 1회 저장

function useLayoutForCols(cols) {
  const key = "c" + cols;
  if (!dashLayout.layouts[key]) {
    // 이 화면 폭을 처음 보는 경우: 구버전 단일 배치 → 가장 가까운 폭의 기존 배치 → 자동 배치 순.
    // 백지에서 자동 배치하면 회전/기기 변경 때마다 "위젯이 초기화됐다"고 느끼므로,
    // 사용자가 만든 상대 배치를 최대한 물려받고 열만 화면 안으로 클램프한다.
    const seed = dashLayout._seedPos || nearestLayoutSeed(cols);
    dashLayout.layouts[key] = seed ? JSON.parse(JSON.stringify(seed)) : {};
    dashLayout._seedPos = null;
    pendingLayoutSave = true;
  }
  dashLayout.pos = dashLayout.layouts[key];
}

/* 저장된 다른 화면 폭 배치 중 열 수가 가장 가까운 것을 상속 (겹치는 칸은 렌더 시 자동 재배치) */
function nearestLayoutSeed(cols) {
  const keys = Object.keys(dashLayout.layouts)
    .filter((k) => /^c\d+$/.test(k) && Object.keys(dashLayout.layouts[k] || {}).length);
  if (!keys.length) return null;
  keys.sort((a, b) => Math.abs(Number(a.slice(1)) - cols) - Math.abs(Number(b.slice(1)) - cols));
  const src = dashLayout.layouts[keys[0]];
  const out = {};
  Object.keys(src).forEach((id) => {
    const p = src[id];
    if (!p || typeof p.c !== "number") return;
    const w = footprint(id).w;
    out[id] = { ...p, c: Math.max(1, Math.min(p.c, cols - w + 1)) };
  });
  return out;
}

/* ===== 페이지(좌우 슬라이드) ===== */
const PAGE_COUNT = 3;
let currentPage = 1;
function widgetPage(id) { const p = dashLayout.pos[id]; return (p && p.p) || 1; }   // 위젯이 속한 페이지(1~3)
function allCanvases() { return [...document.querySelectorAll(".widget-canvas")]; }
function pageCanvas(pg) { return document.querySelector(`.widget-canvas[data-page="${pg}"]`) || document.getElementById("widget-canvas"); }

function presentIds() {
  const ids = [];
  if (!dashLayout.removed.includes("calendar")) ids.push("calendar");
  dashLayout.extra.forEach((id) => {
    if (WIDGET_CATALOG[id] && !WIDGET_CATALOG[id].builtin) ids.push(id);
  });
  return ids;
}

function footprint(id) {
  const w = WIDGET_CATALOG[id] || {};
  return { w: w.w || 1, h: w.h || 1 };
}

function occupiedCells(excludeId, page) {
  page = page || 1;
  const set = new Set();
  // 메인카드(core)는 1페이지에서만 칸을 점유
  if (page === 1) {
    for (let r = coreFp.r; r < coreFp.r + coreFp.h; r++)
      for (let c = coreFp.c; c < coreFp.c + coreFp.w; c++)
        set.add(r + ":" + c);
  }
  presentIds().forEach((id) => {
    if (id === excludeId || widgetPage(id) !== page) return;
    const p = dashLayout.pos[id];
    if (!p) return;
    const { w, h } = footprint(id);
    for (let r = p.r; r < p.r + h; r++)
      for (let c = p.c; c < p.c + w; c++)
        set.add(r + ":" + c);
  });
  return set;
}

function fits(c, r, w, h, occ, cols) {
  if (c < 1 || r < 1 || c + w - 1 > cols) return false;
  for (let rr = r; rr < r + h; rr++)
    for (let cc = c; cc < c + w; cc++)
      if (occ.has(rr + ":" + cc)) return false;
  return true;
}

function firstFree(id, cols) {
  const { w, h } = footprint(id);
  const occ = occupiedCells(id);
  for (let r = 1; r < 100; r++)
    for (let c = 1; c <= cols - w + 1; c++)
      if (fits(c, r, w, h, occ, cols)) return { c, r };
  return { c: 1, r: 1 };
}

function nearestFree(id, tc, tr, cols, page) {
  const { w, h } = footprint(id);
  const occ = occupiedCells(id, page);
  if (fits(tc, tr, w, h, occ, cols)) return { c: tc, r: tr };
  let best = null, bestD = Infinity;
  for (let r = 1; r < 100; r++) {
    for (let c = 1; c <= cols - w + 1; c++) {
      if (!fits(c, r, w, h, occ, cols)) continue;
      const d = (c - tc) ** 2 + (r - tr) ** 2;
      if (d < bestD) { bestD = d; best = { c, r }; }
    }
    if (best && r > tr + 4) break;
  }
  return best || { c: 1, r: 1 };
}

/* (c,r)~(c+w,r+h) 영역과 겹치는 '다른' 위젯 id (같은 페이지). 드롭 시 자리 교환 판단용. */
function widgetOverlapping(c, r, w, h, excludeId, page) {
  for (const id of presentIds()) {
    if (id === excludeId || widgetPage(id) !== page) continue;
    const p = dashLayout.pos[id]; if (!p) continue;
    const f = footprint(id);
    if (c < p.c + f.w && c + w > p.c && r < p.r + f.h && r + h > p.r) return id;
  }
  return null;
}

/* ============================================================
 * 렌더
 * ============================================================ */
function renderCanvas() {
  const canvases = allCanvases();
  if (!canvases.length) return;
  const cols = colsNow();
  useLayoutForCols(cols);   // 현재 화면 폭에 맞는 배치 맵으로 전환
  canvases.forEach((cv) => { cv.style.gridTemplateColumns = `repeat(${cols}, ${CELL_W}px)`; });

  // 1) 메인카드(core): 1페이지 상단 가운데 고정. 높이는 내용에 맞춰 행 수 계산
  const core = document.querySelector(".widget--core");
  if (core) {
    const coreCols = Math.min(CORE_COLS, cols);
    const startC = Math.floor((cols - coreCols) / 2) + 1;
    core.style.gridColumn = `${startC} / span ${coreCols}`;
    core.style.gridRow = "1 / span 1";                 // 측정용 임시
    const rows = Math.max(1, Math.ceil((core.scrollHeight + GAP) / (CELL_H + GAP)));
    core.style.gridRow = `1 / span ${rows}`;
    coreFp = { c: startC, r: 1, w: coreCols, h: rows };
  }

  const present = presentIds();

  // 2) 없어진 위젯 DOM 정리 (모든 페이지, core 제외)
  canvases.forEach((cv) => {
    [...cv.querySelectorAll(".widget")].forEach((el) => {
      const id = el.dataset.widget;
      if (id === "core") return;
      if (!present.includes(id)) {
        if (WIDGET_CATALOG[id] && WIDGET_CATALOG[id].builtin) el.style.display = "none";
        else el.remove();
      }
    });
  });

  // 3) 페이지별로 위젯 배치. 저장 위치(c,r,p)는 유지, 화면이 좁아 안 맞을 때만 표시용 재배치.
  for (let pg = 1; pg <= PAGE_COUNT; pg++) {
    const canvas = pageCanvas(pg);
    if (!canvas) continue;
    const maxRows = visibleRows(canvas);
    const occ = new Set();
    if (pg === 1) {  // 1페이지는 core가 차지하는 칸 선점
      for (let r = coreFp.r; r < coreFp.r + coreFp.h; r++)
        for (let c = coreFp.c; c < coreFp.c + coreFp.w; c++) occ.add(r + ":" + c);
    }
    present.filter((id) => widgetPage(id) === pg).forEach((id) => {
      let el = document.querySelector(`.widget[data-widget="${id}"]`);
      if (!el) el = createTile(id);
      if (el.parentElement !== canvas) canvas.appendChild(el);  // 해당 페이지로 이동
      el.style.display = "";
      const fp = footprint(id);
      const w = Math.min(fp.w, cols);  // 화면이 좁으면 폭을 줄여 오버플로 방지
      const h = fp.h;
      let saved = dashLayout.pos[id];
      if (!saved) { saved = { ...autoSpot(occ, w, h, cols, pg, maxRows), p: pg }; dashLayout.pos[id] = saved; }
      // 저장 위치가 비어 있고 화면 안에 들어올 때만 그대로 사용
      const inView = !maxRows || saved.r + h - 1 <= maxRows;
      const disp = fits(saved.c, saved.r, w, h, occ, cols) && inView
        ? saved
        : autoSpot(occ, w, h, cols, pg, maxRows);
      markOcc(occ, disp.c, disp.r, w, h);
      el.style.gridColumn = `${disp.c} / span ${w}`;
      el.style.gridRow = `${disp.r} / span ${h}`;
    });
  }

  // 이 화면 폭에서 처음 만든 배치를 저장해 다음 진입 때도 같은 자리에 오게 한다.
  // 단, 서버에서 배치를 못 읽어온 상태라면 저장하지 않는다 — 진짜 배치를 덮어쓸 수 있다.
  if (pendingLayoutSave) {
    pendingLayoutSave = false;
    if (!layoutLoadFailed) saveLayout();
  }
}

/* 주어진 점유 집합(occ)에서 첫 빈 칸 찾기 / 칸 점유 표시 */
function firstFreeIn(occ, w, h, cols) {
  for (let r = 1; r < 200; r++)
    for (let c = 1; c <= cols - w + 1; c++)
      if (fits(c, r, w, h, occ, cols)) return { c, r };
  return { c: 1, r: 1 };
}
/* 자동 배치: 1페이지에서는 코어(학생 카드) '아래'부터 줄지어 채운다.
   → 코어 양옆 좁은 빈틈에 흩어져 화면 폭마다 깨져 보이던 문제 방지(어느 폭이든 카드 위+위젯 정렬).
   maxRows(화면에 보이는 마지막 행)를 주면 그 안에서 먼저 찾고, 자리가 없으면
   코어 옆(위쪽 행)까지 훑는다. 가로 화면처럼 세로가 짧을 때 위젯이 탭바 아래로
   숨어버리는 것을 막는다. */
function autoSpot(occ, w, h, cols, page, maxRows) {
  const startR = page === 1 ? coreFp.r + coreFp.h : 1;
  const limit = maxRows && maxRows >= h ? maxRows : 0;

  if (limit) {
    for (let r = startR; r + h - 1 <= limit; r++)
      for (let c = 1; c <= cols - w + 1; c++)
        if (fits(c, r, w, h, occ, cols)) return { c, r };
    // 코어 아래에 자리가 없으면 코어 옆(1행부터)에서 화면 안쪽으로
    for (let r = 1; r + h - 1 <= limit; r++)
      for (let c = 1; c <= cols - w + 1; c++)
        if (fits(c, r, w, h, occ, cols)) return { c, r };
  }

  for (let r = startR; r < 200; r++)
    for (let c = 1; c <= cols - w + 1; c++)
      if (fits(c, r, w, h, occ, cols)) return { c, r };
  return firstFreeIn(occ, w, h, cols);   // 예외적으로 못 찾으면 전체 스캔
}

/* 화면에 보이는 마지막 격자 행 (탭바·상단 여백 제외). 못 구하면 0 = 제한 없음 */
function visibleRows(canvas) {
  if (!canvas) return 0;
  const top = canvas.getBoundingClientRect().top;
  const tabbar = document.querySelector(".tabbar");
  const reserve = (tabbar ? tabbar.getBoundingClientRect().height : 0) + 16;
  const avail = window.innerHeight - top - reserve;
  return avail > CELL_H ? Math.floor((avail + GAP) / (CELL_H + GAP)) : 0;
}
function markOcc(occ, c, r, w, h) {
  for (let rr = r; rr < r + h; rr++)
    for (let cc = c; cc < c + w; cc++) occ.add(rr + ":" + cc);
}

function createTile(id) {
  if (id === "timer") return createTimerTile();
  if (id === "clock") return createClockTile();
  if (id === "weather") return createWeatherTile();
  if (id === "tasks") return createTasksTile();
  if (id === "memo") return createMemoTile();
  if (id === "motto") return createMottoTile();
  const w = WIDGET_CATALOG[id];
  const el = document.createElement("section");
  el.className = "widget widget--tile";
  el.dataset.widget = id;
  el.innerHTML = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <span class="tile__emoji">${w.emoji}</span>
    <span class="tile__title">${w.title}</span>
    ${w.soon ? '<span class="widget-soon__badge">준비중</span>' : ""}`;
  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget(id);
  });
  return el;
}

/* ============================================================
 * 오늘 과제 위젯 (포커스형 — '지금 할 일' 한 개씩 + 완료 체크). 2×2.
 *   · 오늘 daily_checkins.tasks 를 읽어 표시
 *   · 완료/서브 체크 상태는 날짜별 localStorage 에 저장 (공식 성과기록은 체크아웃)
 * ============================================================ */
const taskEsc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let tasksWidget = { tasks: null, cursor: 0 };  // tasks=null → 로딩 중

function createTasksTile() {
  const el = document.createElement("section");
  el.className = "widget widget--tasks";
  el.dataset.widget = "tasks";
  tasksWidget = { tasks: null, cursor: 0 };
  renderTasksWidget(el);   // 로딩 상태 먼저
  loadTodayTasks(el);      // 비동기로 채움
  return el;
}

function taskProgKey() {
  return `dt_taskprog_${dashProfile ? dashProfile.id : "anon"}_${getTodayString()}`;
}
function loadTaskProg() {
  try { return JSON.parse(localStorage.getItem(taskProgKey())) || { done: {}, sub: {} }; }
  catch (e) { return { done: {}, sub: {} }; }
}
function saveTaskProg(p) {
  try { localStorage.setItem(taskProgKey(), JSON.stringify(p)); } catch (e) {}
  // 메인 '오늘 과제' 카드 등 같은 진행상태를 보는 컴포넌트에 즉시 반영 요청
  try { window.dispatchEvent(new CustomEvent("dt-taskprog-changed")); } catch (e) {}
}

// 메인 카드/다른 탭에서 과제 진행상태가 바뀌면 과제 위젯도 즉시 다시 그림 (한 번만 바인딩)
if (!window.__tasksSyncBound) {
  window.__tasksSyncBound = true;
  const rerenderTasksWidget = () => {
    if (!tasksWidget.tasks) return;
    const el = document.querySelector(".widget--tasks");
    if (el) { try { renderTasksWidget(el); } catch (e) {} }
  };
  window.addEventListener("dt-taskprog-changed", rerenderTasksWidget);
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.indexOf("dt_taskprog_") === 0) rerenderTasksWidget();
  });
}

let tasksLoadToken = 0;

/* 약속(p)에 타임아웃을 걸어 무한 대기를 방지 */
function withTimeout(p, ms) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/* 현재 DOM 에 살아있는 과제 위젯을 찾아 다시 그림 (로딩/실패 상태도 안전 처리, 자가복구)
 *   state: "ok" | "error" — "error" 면 다시 시도 버튼 노출 */
function paintTasksWidget(state) {
  const live = document.querySelector(".widget--tasks");
  if (!live) return;
  if (state === "error") {
    live.innerHTML =
      `<button type="button" class="widget__del" aria-label="삭제">−</button>` +
      `<div class="tasksw tasksw--msg"><p class="tasksw__msg">불러오지 못했어요</p>` +
      `<button type="button" data-retry style="margin-top:8px;padding:5px 12px;border:1px solid var(--line,#d8dee9);` +
      `border-radius:8px;background:#fff;font:inherit;font-size:.8rem;font-weight:700;color:var(--navy,#2b3a55);cursor:pointer;">다시 시도</button></div>`;
    wireTasksDelete(live);
    const r = live.querySelector("[data-retry]");
    if (r) r.addEventListener("click", (e) => {
      e.stopPropagation();
      tasksWidget.tasks = null;
      renderTasksWidget(live);   // "불러오는 중…"
      loadTodayTasks(live);
    });
    return;
  }
  try { renderTasksWidget(live); }
  catch (e) { paintTasksWidget("error"); }
}

async function loadTodayTasks(el) {
  const token = ++tasksLoadToken;   // 최신 로드만 반영 (중복/경쟁 시 옛 결과 폐기)
  let list = null;                  // null = 실패(타임아웃/네트워크)
  try {
    const res = await withTimeout(
      supabaseClient
        .from("daily_checkins")
        .select("tasks,task_1,task_2,task_3")
        .eq("student_id", dashProfile.id)
        .eq("date", getTodayString())
        .maybeSingle(),
      8000
    );
    const data = res && res.data;
    list = [];
    if (data) {
      if (Array.isArray(data.tasks) && data.tasks.length) list = data.tasks;
      else list = [1, 2, 3].map((n) => ({ text: data[`task_${n}`] })).filter((t) => t.text);
    }
  } catch (e) { list = null; }
  if (token !== tasksLoadToken) return;   // 더 최신 로드가 시작됨 → 이 결과 폐기

  if (list === null) { tasksWidget.tasks = null; paintTasksWidget("error"); return; }
  tasksWidget.tasks = list.map((t) => ({
    text: t.text || "",
    subject: t.subject || null,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s) => (typeof s === "string" ? s : s && s.text)).filter(Boolean) : [],
  }));
  const prog = loadTaskProg();
  const firstUndone = tasksWidget.tasks.findIndex((_, i) => !prog.done[i]);
  tasksWidget.cursor = firstUndone < 0 ? 0 : firstUndone;
  paintTasksWidget("ok");
}

function renderTasksWidget(el) {
  const delBtn = `<button type="button" class="widget__del" aria-label="삭제">−</button>`;
  const tasks = tasksWidget.tasks;

  if (tasks === null) {
    el.innerHTML = delBtn + `<div class="tasksw tasksw--msg"><p class="tasksw__msg">불러오는 중…</p></div>`;
    wireTasksDelete(el);
    return;
  }
  if (tasks.length === 0) {
    el.innerHTML = delBtn + `
      <div class="tasksw tasksw--msg">
        <span class="tasksw__emoji">📝</span>
        <p class="tasksw__msg">오늘 플랜이 없어요</p>
        <button type="button" class="tasksw__cta" data-go="checkin">오늘 플랜 만들기</button>
      </div>`;
    wireTasksDelete(el);
    el.querySelector('[data-go="checkin"]').addEventListener("click", (e) => {
      e.stopPropagation(); if (!editMode) location.href = "/checkin.html";
    });
    return;
  }

  const prog = loadTaskProg();
  const n = tasks.length;
  const doneCount = tasks.reduce((a, _, i) => a + (prog.done[i] ? 1 : 0), 0);
  const allDone = doneCount === n;
  const cur = Math.max(0, Math.min(n - 1, tasksWidget.cursor));
  const t = tasks[cur];
  const isDone = !!prog.done[cur];
  const subDone = prog.sub[cur] || {};
  const navHidden = n <= 1 ? " is-hidden" : "";

  const subsHtml = t.subtasks
    .map((s, j) => `
      <button type="button" class="tasksw__sub${subDone[j] ? " is-done" : ""}" data-sub="${j}">
        <span class="tasksw__check">${subDone[j] ? "✓" : ""}</span>
        <span class="tasksw__sub-text">${taskEsc(s)}</span>
      </button>`)
    .join("");

  el.innerHTML = delBtn + `
    <div class="tasksw${isDone ? " is-done" : ""}">
      <div class="tasksw__top">
        <button type="button" class="tasksw__nav${navHidden}" data-nav="-1" aria-label="이전">‹</button>
        <span class="tasksw__label">${allDone ? "🎉 오늘 과제 완료!" : "지금 할 일"}</span>
        <span class="tasksw__count">${doneCount}/${n}</span>
        <button type="button" class="tasksw__nav${navHidden}" data-nav="1" aria-label="다음">›</button>
      </div>
      <div class="tasksw__body">
        ${t.subject ? `<span class="tasksw__subject">${taskEsc(subjectLabel(t.subject))}</span>` : ""}
        <p class="tasksw__title">${taskEsc(t.text)}</p>
        ${t.subtasks.length ? `<div class="tasksw__subs">${subsHtml}</div>` : ""}
      </div>
      <button type="button" class="tasksw__done${isDone ? " is-done" : ""}" data-done>${isDone ? "✓ 완료됨 · 되돌리기" : "완료"}</button>
    </div>`;

  wireTasksDelete(el);
  el.querySelectorAll(".tasksw__nav").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation(); if (editMode) return;
      tasksWidget.cursor = (cur + Number(b.dataset.nav) + n) % n;
      renderTasksWidget(el);
    }));
  el.querySelectorAll(".tasksw__sub").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation(); if (editMode) return;
      const j = b.dataset.sub;
      const p = loadTaskProg();
      if (!p.sub[cur]) p.sub[cur] = {};
      if (p.sub[cur][j]) delete p.sub[cur][j]; else p.sub[cur][j] = true;
      saveTaskProg(p);
      renderTasksWidget(el);
    }));
  el.querySelector("[data-done]").addEventListener("click", (e) => {
    e.stopPropagation(); if (editMode) return;
    const p = loadTaskProg();
    if (p.done[cur]) delete p.done[cur]; else p.done[cur] = true;
    saveTaskProg(p);
    renderTasksWidget(el);   // 완료해도 현재 과제에 그대로 머무름(자동 이동 없음)
  });
}

function wireTasksDelete(el) {
  const del = el.querySelector(".widget__del");
  if (del) del.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("tasks");
  });
}

function wireCalendarDelete() {
  const cal = document.querySelector(".widget--calendar");
  if (cal && !cal.dataset.wired) {
    const del = cal.querySelector(".widget__del");
    if (del) del.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); removeWidget("calendar");
    });
    cal.dataset.wired = "1";
  }
}

/* ============================================================
 * 삭제 / 추가
 * ============================================================ */
function removeWidget(id) {
  if (id === "timer") timerStop();
  if (id === "clock" && clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  const w = WIDGET_CATALOG[id];
  if (w && w.builtin) {
    if (!dashLayout.removed.includes(id)) dashLayout.removed.push(id);
  } else {
    dashLayout.extra = dashLayout.extra.filter((x) => x !== id);
  }
  delete dashLayout.pos[id];
  renderCanvas();
  saveLayout();
}

function addWidget(id) {
  const w = WIDGET_CATALOG[id];
  if (w && w.builtin) {
    dashLayout.removed = dashLayout.removed.filter((x) => x !== id);
  } else if (!dashLayout.extra.includes(id)) {
    dashLayout.extra.push(id);
  }
  // 지금 보고 있는 페이지의 빈 칸에 새로 배치
  const cols = colsNow();
  const fp = footprint(id);
  const wW = Math.min(fp.w, cols);
  const spot = firstFreeIn(occupiedCells(id, currentPage), wW, fp.h, cols);
  dashLayout.pos[id] = { c: spot.c, r: spot.r, p: currentPage };
  renderCanvas();
  saveLayout();
}

/* ============================================================
 * 편집 모드 (롱프레스 진입 → 흔들림). core 제외.
 * ============================================================ */
function setupLongPress() {
  const area = document.getElementById("pager") || document.querySelector(".home-main");
  if (!area) return;

  let timer = null, sx = 0, sy = 0;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

  area.addEventListener("pointerdown", (e) => {
    if (editMode) return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(enterEditMode, 500);
  });
  area.addEventListener("pointermove", (e) => {
    if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel();
  });
  area.addEventListener("pointerup", cancel);
  area.addEventListener("pointerleave", cancel);
  area.addEventListener("pointercancel", cancel);
  area.addEventListener("contextmenu", (e) => e.preventDefault());
  area.addEventListener("click", (e) => {
    if (editMode && e.target.closest("a")) e.preventDefault();
  }, true);
}

function enterEditMode() {
  if (editMode) return;
  editMode = true;
  applyEditModeClass();
  showEditBar(true);
  document.addEventListener("keydown", onEditKey);
}

function exitEditMode() {
  editMode = false;
  applyEditModeClass();
  showEditBar(false);
  closeCatalog();
  document.removeEventListener("keydown", onEditKey);
  saveLayout();
}

function onEditKey(e) { if (e.key === "Escape") exitEditMode(); }

function applyEditModeClass() {
  document.body.classList.toggle("dash--edit", editMode);
  const entry = document.getElementById("edit-enter");
  if (entry) entry.textContent = editMode ? "완료" : "편집";
}

function showEditBar(show) {
  let bar = document.getElementById("edit-bar");
  if (show) {
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "edit-bar";
      bar.className = "edit-bar";
      bar.innerHTML = `
        <button type="button" class="edit-bar__btn edit-bar__add" id="edit-add">+ 위젯 추가</button>
        <button type="button" class="edit-bar__btn edit-bar__done" id="edit-done">완료</button>`;
      document.body.appendChild(bar);
      bar.querySelector("#edit-done").addEventListener("click", exitEditMode);
      bar.querySelector("#edit-add").addEventListener("click", openCatalog);
    }
    bar.hidden = false;
  } else if (bar) {
    bar.hidden = true;
  }
}

/* ============================================================
 * 위젯 추가 카탈로그
 * ============================================================ */
function openCatalog() {
  const available = Object.keys(WIDGET_CATALOG).filter((id) => {
    const w = WIDGET_CATALOG[id];
    return w.builtin ? dashLayout.removed.includes(id) : !dashLayout.extra.includes(id);
  });

  let modal = document.getElementById("catalog-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "catalog-modal";
    modal.className = "catalog-modal";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeCatalog(); });
  }
  modal.innerHTML = `
    <div class="catalog">
      <div class="catalog__head">
        <h3 class="catalog__title-h">위젯 추가</h3>
        <button type="button" class="catalog__close" aria-label="닫기">✕</button>
      </div>
      <div class="catalog__list">
        ${available.length ? available.map((id) => {
          const w = WIDGET_CATALOG[id];
          const badge = w.soon ? ' <span class="widget-soon__badge">준비중</span>' : "";
          return `<button type="button" class="catalog__item" data-add="${id}">
            <span class="catalog__emoji">${w.emoji}</span>
            <span class="catalog__body">
              <span class="catalog__name">${w.title}${badge}</span>
              <span class="catalog__desc">${w.desc}</span>
            </span>
            <span class="catalog__plus">추가 +</span>
          </button>`;
        }).join("") : `<p class="catalog__empty">추가할 수 있는 위젯이 모두 추가됐어요.</p>`}
      </div>
    </div>`;
  modal.querySelector(".catalog__close").addEventListener("click", closeCatalog);
  modal.querySelectorAll(".catalog__item").forEach((b) => {
    b.addEventListener("click", () => { addWidget(b.dataset.add); closeCatalog(); });
  });
  modal.hidden = false;
}

function closeCatalog() {
  const modal = document.getElementById("catalog-modal");
  if (modal) modal.hidden = true;
}

/* ============================================================
 * 드래그 자유 배치 (편집 모드)
 * ============================================================ */
let drag = null;

function setupDrag() {
  allCanvases().forEach((canvas) => {
    if (canvas.dataset.dragWired) return;
    canvas.addEventListener("pointerdown", onDragStart);
    canvas.dataset.dragWired = "1";
  });
}

function onDragStart(e) {
  if (!editMode) return;
  const tile = e.target.closest(".widget");
  if (!tile || tile.classList.contains("widget--core")) return;
  if (e.target.closest(".widget__del")) return;
  e.preventDefault();
  const tr = tile.getBoundingClientRect();
  drag = {
    id: tile.dataset.widget,
    tile,
    canvas: tile.closest(".widget-canvas"),   // 위젯이 놓인 페이지 캔버스
    page: widgetPage(tile.dataset.widget),
    startX: e.clientX, startY: e.clientY,
    grabDX: e.clientX - tr.left,   // 위젯 안에서 집은 지점(좌상단 기준 오프셋) — 미리보기/낙하 위치 보정용
    grabDY: e.clientY - tr.top,
    moved: false,
  };
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
  document.addEventListener("pointercancel", onDragEnd);
}

function targetCell(clientX, clientY) {
  const cols = colsNow();
  const rect = drag.canvas.getBoundingClientRect();
  const gridW = cols * CELL_W + (cols - 1) * GAP;
  const offsetLeft = Math.max(0, (rect.width - gridW) / 2);   // 가운데 정렬 보정
  const { w, h } = footprint(drag.id);
  // 커서가 아니라 '위젯 좌상단'의 화면 위치를 격자에 매핑(집은 지점 보정) → 미리보기·착지점이 위젯과 일치
  const left = clientX - (drag.grabDX || 0) - rect.left - offsetLeft;
  const top  = clientY - (drag.grabDY || 0) - rect.top;
  let c = Math.round(left / (CELL_W + GAP)) + 1;   // 가장 가까운 칸으로 스냅
  let r = Math.round(top / (CELL_H + GAP)) + 1;
  c = Math.max(1, Math.min(c, cols - w + 1));
  r = Math.max(1, r);
  return { c, r, w, h, cols };
}

function showGhost(clientX, clientY) {
  const { c, r, w, h } = targetCell(clientX, clientY);
  let gc = c, gr = r;
  // 같은 크기 위젯 위에 있으면 그 위젯 칸을 미리보기(자리 교환 예고)
  const occId = widgetOverlapping(c, r, w, h, drag.id, drag.page);
  if (occId) {
    const occFp = footprint(occId), occ = dashLayout.pos[occId];
    if (occ && occFp.w === w && occFp.h === h) { gc = occ.c; gr = occ.r; }
  }
  let ghost = document.getElementById("drop-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = "drop-ghost";
    ghost.className = "drop-ghost";
    drag.canvas.appendChild(ghost);
  }
  ghost.style.gridColumn = `${gc} / span ${w}`;
  ghost.style.gridRow = `${gr} / span ${h}`;
}

function onDragMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  if (!drag.moved) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    drag.moved = true;
    drag.tile.classList.add("dragging");
  }
  drag.tile.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
  showGhost(e.clientX, e.clientY);
}

function onDragEnd(e) {
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragEnd);
  const ghost = document.getElementById("drop-ghost");
  if (ghost) ghost.remove();
  if (!drag) return;
  drag.tile.classList.remove("dragging");
  drag.tile.style.transform = "";
  if (drag.moved) {
    const { c, r, w, h, cols } = targetCell(e.clientX, e.clientY);
    const me = dashLayout.pos[drag.id];
    const occId = widgetOverlapping(c, r, w, h, drag.id, drag.page);
    const occ = occId ? dashLayout.pos[occId] : null;
    const occFp = occId ? footprint(occId) : null;
    if (occId && me && occ && occFp && occFp.w === w && occFp.h === h) {
      // 같은 크기 위젯 위에 놓으면 → 자리 교환(서로 맞바꿈). '제자리로 튕김' 방지
      dashLayout.pos[drag.id] = { c: occ.c, r: occ.r, p: drag.page };
      dashLayout.pos[occId]  = { c: me.c,  r: me.r,  p: drag.page };
    } else {
      // 빈 곳이거나 크기가 다른 위젯이면 → 가장 가까운 빈 칸
      const spot = nearestFree(drag.id, c, r, cols, drag.page);
      dashLayout.pos[drag.id] = { c: spot.c, r: spot.r, p: drag.page };
    }
    renderCanvas();
    saveLayout();
  }
  drag = null;
}

/* ============================================================
 * 타이머 위젯 (아이폰 타이머풍 카운트다운). 2×2 정사각형.
 * ============================================================ */
/* 타이머 위젯 — 시계 면(face)을 직접 조작하는 제스처 방식.
 *   · 탭          → 시작 / 정지 (토글)
 *   · 두 번 탭    → 0:00 으로 초기화
 *   · 길게 누르기 → 1분씩 서서히 증가(시간 설정), 떼고 탭하면 시작
 */
let timerState = { remaining: 25 * 60, running: false, done: false, interval: null };

const TIMER_HOLD_MS = 280;   // 이만큼 누르고 있으면 '시간 설정(다이얼)' 모드 진입
const TIMER_DBL_MS  = 260;   // 더블탭으로 인정하는 간격
const TIMER_STEP_MS = 350;   // 길게 누르는 동안 1분씩 올라가는 간격
const TIMER_MAX = 180 * 60;  // 최대 3시간

function createTimerTile() {
  const el = document.createElement("section");
  el.className = "widget widget--timer" + (timerState.running ? " is-running" : "");
  el.dataset.widget = "timer";
  el.innerHTML = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <span class="timer__label">타이머</span>
    <div class="timer__face" role="button" tabindex="0" aria-label="타이머: 탭 시작·정지, 두 번 탭 초기화, 길게 눌러 시간 설정">
      ${timerDialSvg()}
      <div class="timer__time" id="timer-time">${timerFmt(timerState.remaining)}</div>
    </div>
    <p class="timer__hint">탭 시작·정지 · 두 번 탭 초기화 · 길게 시간+</p>`;
  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("timer");
  });
  attachTimerGestures(el.querySelector(".timer__face"));
  timerRender();
  return el;
}

// 탭 / 더블탭 / 롱프레스(시간 다이얼) 제스처 처리
function attachTimerGestures(face) {
  let downT = 0, sx = 0, sy = 0, moved = false;
  let holdTimer = null, dialTimer = null, dialing = false, tapTimer = null;

  const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
  const bumpMinute = () => {
    timerState.done = false;
    timerState.remaining = Math.min(TIMER_MAX, Math.floor(timerState.remaining / 60) * 60 + 60);
    timerRender();
  };
  const startDial = () => {
    dialing = true;
    timerStop();
    bumpMinute();                                  // 첫 1분 즉시 반영
    dialTimer = setInterval(bumpMinute, TIMER_STEP_MS);
  };
  const stopDial = () => {
    if (dialTimer) { clearInterval(dialTimer); dialTimer = null; }
    dialing = false;
  };

  face.addEventListener("pointerdown", (e) => {
    if (editMode) return;                          // 편집 모드에서는 이동/삭제 우선
    e.stopPropagation();                           // 대시보드 롱프레스·드래그와 충돌 방지
    downT = Date.now(); sx = e.clientX; sy = e.clientY; moved = false;
    try { face.setPointerCapture(e.pointerId); } catch (_) {}
    clearHold();
    holdTimer = setTimeout(startDial, TIMER_HOLD_MS);
  });
  face.addEventListener("pointermove", (e) => {
    if (!moved && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) {
      moved = true; clearHold();
    }
  });
  const onUp = () => {
    if (editMode) return;
    clearHold();
    if (dialing) { stopDial(); return; }           // 시간 설정 끝 — 토글/초기화 안 함
    if (moved) return;                             // 드래그였으면 무시
    if (tapTimer) {                                // 두 번째 탭 → 초기화
      clearTimeout(tapTimer); tapTimer = null;
      timerReset();
    } else {                                       // 첫 탭 → 더블탭 기다렸다가 토글
      tapTimer = setTimeout(() => { tapTimer = null; timerToggle(); }, TIMER_DBL_MS);
    }
  };
  face.addEventListener("pointerup", onUp);
  face.addEventListener("pointercancel", () => { clearHold(); stopDial(); });
  face.addEventListener("keydown", (e) => {       // 키보드 접근성: Enter/Space = 토글
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); timerToggle(); }
  });
}

/* 중앙 눈금 다이얼 (60개 틱, 12시 방향 앰버 강조) */
function timerDialSvg() {
  let t = "";
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) * Math.PI / 180;
    const top = i === 0;
    const r1 = 47, r2 = top ? 40 : 43.5;
    const x1 = (50 + r1 * Math.cos(a)).toFixed(2), y1 = (50 + r1 * Math.sin(a)).toFixed(2);
    const x2 = (50 + r2 * Math.cos(a)).toFixed(2), y2 = (50 + r2 * Math.sin(a)).toFixed(2);
    t += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${top ? "#e0a23c" : "rgba(120,95,55,0.16)"}" stroke-width="${top ? 1.6 : 0.9}" stroke-linecap="round"/>`;
  }
  return `<svg class="timer__dial" viewBox="0 0 100 100" aria-hidden="true">${t}</svg>`;
}

function timerFmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function timerRender() {
  const time = document.getElementById("timer-time");
  if (time) time.textContent = timerFmt(timerState.remaining);
  const w = document.querySelector(".widget--timer");
  if (w) {
    w.classList.toggle("is-running", timerState.running);
    w.classList.toggle("is-done", timerState.done);
  }
}

function timerStop() {
  timerState.running = false;
  if (timerState.interval) { clearInterval(timerState.interval); timerState.interval = null; }
  timerRender();
}

function timerToggle() {
  if (timerState.running) { timerStop(); return; }
  if (timerState.remaining <= 0) return;     // 0:00 — 먼저 길게 눌러 시간을 설정
  timerState.done = false;
  timerState.running = true;
  timerState.interval = setInterval(timerTick, 1000);
  timerRender();
}

function timerTick() {
  if (!document.getElementById("timer-time")) { timerStop(); return; } // 위젯 사라지면 정지
  timerState.remaining = Math.max(0, timerState.remaining - 1);
  if (timerState.remaining === 0) { timerState.done = true; timerStop(); }
  else timerRender();
}

function timerReset() {
  timerStop();
  timerState.remaining = 0;
  timerState.done = false;
  timerRender();
}

/* ============================================================
 * 시계 위젯 (현재 시각). 2×2.
 * ============================================================ */
let clockInterval = null;

// 시계 디자인 목록 (버튼 누를 때마다 이 순서로 순환).
//   digital = 디지털(기본),  analog = 카시오 MQ-24 풍 아날로그
const CLOCK_DESIGNS = ["digital", "analog"];
function clockDesign() {
  const d = dashLayout.clock && dashLayout.clock.design;
  return CLOCK_DESIGNS.includes(d) ? d : "digital";
}

function createClockTile() {
  const el = document.createElement("section");
  el.className = "widget widget--clock";
  el.dataset.widget = "clock";
  renderClockFace(el);
  if (!clockInterval) clockInterval = setInterval(clockTick, 1000);
  return el;
}

// 현재 디자인으로 위젯 내용을 그림(삭제·디자인변경 버튼 포함). 디자인 변경 시 제자리에서 다시 호출.
function renderClockFace(el) {
  const design = clockDesign();
  el.classList.toggle("widget--clock-analog", design === "analog");
  const ctrls = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <button type="button" class="widget__opt clock__design" aria-label="시계 디자인 변경" title="디자인 변경">⇆</button>`;
  if (design === "analog") {
    el.innerHTML = ctrls + analogWatchSVG();
  } else {
    el.innerHTML = ctrls + `
      <span class="clock__ampm"></span>
      <div class="clock__time">--:--</div>
      <div class="clock__date"></div>`;
  }
  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("clock");
  });
  const opt = el.querySelector(".clock__design");
  opt.addEventListener("pointerdown", (e) => e.stopPropagation());  // 드래그/롱프레스와 충돌 방지
  opt.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const cur = clockDesign();
    const next = CLOCK_DESIGNS[(CLOCK_DESIGNS.indexOf(cur) + 1) % CLOCK_DESIGNS.length];
    if (!dashLayout.clock) dashLayout.clock = {};
    dashLayout.clock.design = next;
    saveLayout();
    renderClockFace(el);  // 같은 칸에서 디자인만 교체
  });
  clockTick();
}

function clockTick() {
  const el = document.querySelector(".widget--clock");
  if (!el) { if (clockInterval) { clearInterval(clockInterval); clockInterval = null; } return; }
  const now = new Date();
  if (el.classList.contains("widget--clock-analog")) { updateAnalogHands(el, now); return; }
  const h = now.getHours(), m = now.getMinutes();
  const h12 = (h % 12) || 12;
  const t = el.querySelector(".clock__time");
  if (t) t.textContent = `${h12}:${String(m).padStart(2, "0")}`;
  const a = el.querySelector(".clock__ampm");
  if (a) a.textContent = h < 12 ? "오전" : "오후";
  const d = el.querySelector(".clock__date");
  if (d) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    d.textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
  }
}

// 카시오 MQ-24 풍 아날로그 시계 SVG. 시/분/초침은 class 로 찾아 회전시킴.
const CLOCK_CX = 100, CLOCK_CY = 106;
function analogWatchSVG() {
  const cx = CLOCK_CX, cy = CLOCK_CY, numR = 50, tickO = 63, RAD = Math.PI / 180;
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * RAD, major = i % 5 === 0;
    const len = major ? 6 : 3, w = major ? 1.5 : 0.7;
    const x1 = (cx + tickO * Math.sin(a)).toFixed(1), y1 = (cy - tickO * Math.cos(a)).toFixed(1);
    const x2 = (cx + (tickO - len) * Math.sin(a)).toFixed(1), y2 = (cy - (tickO - len) * Math.cos(a)).toFixed(1);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="${w}"/>`;
  }
  let nums = "";
  for (let n = 1; n <= 12; n++) {
    const a = n * 30 * RAD;
    const x = (cx + numR * Math.sin(a)).toFixed(1), y = (cy - numR * Math.cos(a)).toFixed(1);
    nums += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#111">${n}</text>`;
  }
  return `
  <svg class="clock__watch" viewBox="22 28 156 156" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="아날로그 시계">
    <defs>
      <radialGradient id="cwBezel" cx="0.4" cy="0.34" r="0.85">
        <stop offset="0" stop-color="#404040"/><stop offset="0.6" stop-color="#1a1a1a"/><stop offset="1" stop-color="#000"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="74" fill="url(#cwBezel)"/>
    <circle cx="${cx}" cy="${cy}" r="71.5" fill="#0d0d0d"/>
    <circle cx="${cx}" cy="${cy}" r="70.5" fill="#fafafa"/>
    ${ticks}
    ${nums}
    <text x="${cx}" y="${cy - 22}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="800" letter-spacing="1.5" fill="#111">CASIO</text>
    <text x="${cx}" y="${cy - 11}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="6.5" font-weight="600" letter-spacing="1.5" fill="#333">QUARTZ</text>
    <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="5.5" font-weight="600" letter-spacing="1" fill="#333">WATER RESIST</text>
    <line class="clock__hour" x1="${cx}" y1="${cy + 9}" x2="${cx}" y2="${cy - 34}" stroke="#0a0a0a" stroke-width="4.5" stroke-linecap="round"/>
    <line class="clock__min" x1="${cx}" y1="${cy + 11}" x2="${cx}" y2="${cy - 50}" stroke="#0a0a0a" stroke-width="3" stroke-linecap="round"/>
    <line class="clock__sec" x1="${cx}" y1="${cy + 15}" x2="${cx}" y2="${cy - 54}" stroke="#111" stroke-width="1" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="3.2" fill="#0a0a0a"/>
  </svg>`;
}

function updateAnalogHands(el, now) {
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const set = (sel, deg) => {
    const n = el.querySelector(sel);
    if (n) n.setAttribute("transform", `rotate(${deg.toFixed(2)} ${CLOCK_CX} ${CLOCK_CY})`);
  };
  set(".clock__hour", (h % 12) * 30 + m * 0.5);
  set(".clock__min", m * 6 + s * 0.1);
  set(".clock__sec", s * 6);
}

/* ============================================================
 * 날씨 위젯 (Open-Meteo, 키 불필요). 2×2.
 * ============================================================ */
function createWeatherTile() {
  const el = document.createElement("section");
  el.className = "widget widget--weather";
  el.dataset.widget = "weather";
  el.innerHTML = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <button type="button" class="widget__opt weather__region" aria-label="지역 변경" title="지역 변경">⌖</button>
    <div class="weather__top">
      <span class="weather__loc" id="weather-loc">--</span>
      <svg class="weather__nav" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 3.4c.66-.26 1.3.38 1.04 1.04L15 21c-.3.76-1.4.66-1.55-.14l-1.27-6.04-6.04-1.27c-.8-.16-.9-1.25-.14-1.55z"/></svg>
    </div>
    <div class="weather__temp" id="weather-temp">--°</div>
    <div class="weather__info">
      <span class="weather__icon" id="weather-icon"></span>
      <span class="weather__cond" id="weather-cond">불러오는 중…</span>
      <span class="weather__hilo" id="weather-hilo">최고:--° 최저:--°</span>
    </div>`;
  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("weather");
  });
  const regionBtn = el.querySelector(".weather__region");
  regionBtn.addEventListener("pointerdown", (e) => e.stopPropagation());  // 드래그/롱프레스와 충돌 방지
  regionBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); openWeatherRegionMenu(regionBtn);
  });
  loadWeather();
  return el;
}

/* 직접 만든 아이콘 PNG (assets/weather) — 해시 파일명 매핑 */
const WEATHER_ICONS = {
  clearDay:    "575900edccbc7def167f7874c02aeb0b",  // 맑음 (해)
  clearNight:  "1200cde3569cf69bd80e1ddabc0f15cd",  // 맑음 (달+별)
  partlyDay:   "67aaf9dbe30989c25cbde6c6ec099213",  // 한때 흐림 (구름+해)
  partlyNight: "17cc1a8a95028b89ba6988ee47eeab29",  // 한때 흐림 (구름+달)
  cloudy:      "66117fab0f288a2867b340fa2fcde31b",  // 흐림 (구름)
  fog:         "d35bb25d12281cd9ee5ce78a98cd2aa7",  // 안개
  drizzle:     "4417bf88c7bbcd8e24fb78ee6479b362",  // 이슬비
  rain:        "451d37e6cea3af4a568110863a1adcf7",  // 비
  heavyRain:   "a55fef55bbeb0762a8dd329b4b8ad342",  // 강한 비
  rainNight:   "d4b6596291c114305b64056bd92ccee3",  // 비 (밤)
  snow:        "9189cb49e806d1ebfeed24f33367143c",  // 눈
  heavySnow:   "e95fb90fc5a4aac111be78770921beb1",  // 폭설
  thunder:     "efffb1e26f6de5bf5c8adbd872a2933a",  // 뇌우
};

function wmoWeather(code, isDay) {
  const night = !isDay;
  let key, text;
  if (code === 0) { key = night ? "clearNight" : "clearDay"; text = "맑음"; }
  else if (code <= 2) { key = night ? "partlyNight" : "partlyDay"; text = "대체로 맑음"; }
  else if (code === 3) { key = "cloudy"; text = "흐림"; }
  else if (code <= 48) { key = "fog"; text = "안개"; }
  else if (code <= 57) { key = night ? "rainNight" : "drizzle"; text = "이슬비"; }
  else if (code <= 64) { key = night ? "rainNight" : "rain"; text = "비"; }
  else if (code <= 67) { key = "heavyRain"; text = "강한 비"; }
  else if (code <= 77) { key = "snow"; text = "눈"; }
  else if (code <= 81) { key = night ? "rainNight" : "rain"; text = "소나기"; }
  else if (code === 82) { key = "heavyRain"; text = "강한 소나기"; }
  else if (code <= 86) { key = "heavySnow"; text = "눈"; }
  else { key = "thunder"; text = "뇌우"; }
  return { img: `/assets/weather/${WEATHER_ICONS[key]}.png`, text };
}

/* 지역: 저장된 선택 → 없으면 IP로 추정(위치 권한 불필요) → 실패 시 서울 */
const WEATHER_CITIES = [
  { name: "서울", lat: 37.5665, lon: 126.978 },
  { name: "인천", lat: 37.4563, lon: 126.7052 },
  { name: "수원", lat: 37.2636, lon: 127.0286 },
  { name: "춘천", lat: 37.8813, lon: 127.7298 },
  { name: "강릉", lat: 37.7519, lon: 128.8761 },
  { name: "청주", lat: 36.6424, lon: 127.489 },
  { name: "천안", lat: 36.8151, lon: 127.1139 },
  { name: "대전", lat: 36.3504, lon: 127.3845 },
  { name: "세종", lat: 36.48, lon: 127.289 },
  { name: "전주", lat: 35.8242, lon: 127.148 },
  { name: "광주", lat: 35.1595, lon: 126.8526 },
  { name: "여수", lat: 34.7604, lon: 127.6622 },
  { name: "대구", lat: 35.8714, lon: 128.6014 },
  { name: "포항", lat: 36.019, lon: 129.3435 },
  { name: "부산", lat: 35.1796, lon: 129.0756 },
  { name: "울산", lat: 35.5384, lon: 129.3114 },
  { name: "창원", lat: 35.2281, lon: 128.6811 },
  { name: "제주", lat: 33.4996, lon: 126.5312 },
];
function nearestWeatherCity(lat, lon) {
  let best = WEATHER_CITIES[0], bd = Infinity;
  WEATHER_CITIES.forEach((c) => {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

function openWeatherRegionMenu(anchor) {
  const old = document.getElementById("weather-region-menu");
  if (old) { old.remove(); return; }
  const menu = document.createElement("div");
  menu.id = "weather-region-menu";
  menu.className = "weather-regionmenu";
  const cur = dashLayout.weather && dashLayout.weather.name;
  menu.innerHTML =
    `<button type="button" data-auto class="${cur ? "" : "is-on"}">자동 (내 위치 추정)</button>` +
    WEATHER_CITIES.map((c) =>
      `<button type="button" data-city="${c.name}" class="${cur === c.name ? "is-on" : ""}">${c.name}</button>`).join("");
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(window.innerWidth - 190, r.left - 8)) + "px";
  menu.style.top = (r.bottom + 6) + "px";
  const close = () => { menu.remove(); document.removeEventListener("pointerdown", onDoc, true); };
  const onDoc = (e) => { if (!menu.contains(e.target)) close(); };
  document.addEventListener("pointerdown", onDoc, true);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.auto !== undefined) dashLayout.weather = null;
    else dashLayout.weather = WEATHER_CITIES.find((c) => c.name === b.dataset.city) || null;
    saveLayout();
    close();
    loadWeather();
  });
}

function loadWeather() {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const fetchAt = (lat, lon, locName) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!document.getElementById("weather-temp")) return; // 위젯 사라짐
        const w = wmoWeather(d.current.weather_code, d.current.is_day === 1);
        const iconEl = document.getElementById("weather-icon");
        if (iconEl) iconEl.innerHTML = `<img src="${w.img}" alt="" />`;
        set("weather-temp", Math.round(d.current.temperature_2m) + "°");
        set("weather-cond", w.text);
        set("weather-loc", locName);
        if (d.daily) set("weather-hilo",
          `최고:${Math.round(d.daily.temperature_2m_max[0])}° 최저:${Math.round(d.daily.temperature_2m_min[0])}°`);
      })
      .catch(() => set("weather-cond", "날씨 정보를 못 불러왔어요"));
  };

  const cfg = dashLayout.weather;
  if (cfg && typeof cfg.lat === "number") { fetchAt(cfg.lat, cfg.lon, cfg.name); return; }
  // 자동: IP 기반 대략적 위치 추정 (권한 팝업 없음). 국내면 가까운 도시명으로 표기.
  fetch("https://ipwho.is/")
    .then((r) => r.json())
    .then((d) => {
      if (d && d.success !== false && typeof d.latitude === "number") {
        if (d.country_code === "KR") {
          const c = nearestWeatherCity(d.latitude, d.longitude);
          fetchAt(c.lat, c.lon, c.name);
        } else {
          fetchAt(d.latitude, d.longitude, d.city || "내 위치");
        }
      } else {
        const s = WEATHER_CITIES[0]; fetchAt(s.lat, s.lon, s.name);
      }
    })
    .catch(() => { const s = WEATHER_CITIES[0]; fetchAt(s.lat, s.lon, s.name); });
}

/* ============================================================
 * 첫 페인트 전 동기 레이아웃 (FOUC 제거)
 * ------------------------------------------------------------
 * 인증/프로필 네트워크를 기다리지 않고, 스크립트 로드 시점에
 * 즉시 격자를 배치한다. renderCanvas()는 프로필이 필요 없고
 * (레이아웃은 localStorage 폴백), 이 스크립트는 캔버스 DOM
 * 아래에서 동기 실행되므로 브라우저가 좁은 기본 격자를
 * 그리기 전에 최종 배치가 끝난다. 같은 기기 재방문이면 직전
 * 레이아웃(저장 위젯/위치)까지 복원해 위젯 깜빡임도 줄인다.
 * 실제 프로필 로드 후 initDashboard 가 다시 렌더해 동기화한다.
 * ============================================================ */
(function primeLayout() {
  try {
    const lastId = localStorage.getItem("dt_dashboard_lastid");
    const raw = lastId ? localStorage.getItem(layoutKey(lastId)) : null;
    dashLayout = normalizeLayout(raw ? JSON.parse(raw) : null);
  } catch (e) {
    dashLayout = normalizeLayout(null);
  }
  try {
    renderCanvas();
  } catch (e) {
    /* 측정 실패해도 화면은 반드시 노출 */
  } finally {
    document.body.classList.add("dash-ready");
  }
})();

/* ============================================================
 * 메모장 위젯 (자유 메모 + 폰트 선택). 2×2.
 * - 내용/폰트는 dashLayout.memo 에 저장 (Supabase + localStorage).
 * ============================================================ */
// size = 기준 크기 대비 배율 (손글씨 계열은 시각적으로 작아 더 키움)
const MEMO_FONTS = [
  { key: "default", label: "기본",     css: '"Pretendard Variable", system-ui, sans-serif', size: 1.0 },
  { key: "hand",    label: "손글씨",   css: '"Nanum Pen Script", cursive', size: 1.55 },
  { key: "round",   label: "또박또박", css: '"Gaegu", cursive', size: 1.2 },
  { key: "serif",   label: "명조",     css: '"Nanum Myeongjo", serif', size: 1.0 },
];
const MEMO_BASE_PX = 15;  // 기본 글자 크기(px)
function applyMemoFont(ta, key) {
  const f = MEMO_FONTS.find((x) => x.key === key) || MEMO_FONTS[0];
  ta.style.fontFamily = f.css;
  ta.style.fontSize = Math.round(MEMO_BASE_PX * (f.size || 1)) + "px";
}

let memoSaveTimer = null;
function memoSaveDebounced() {
  // localStorage 는 즉시(가볍게), Supabase 는 디바운스(타이핑 폭주 방지)
  try {
    if (dashProfile) {
      localStorage.setItem(layoutKey(dashProfile.id), JSON.stringify(dashLayout));
      localStorage.setItem("dt_dashboard_lastid", dashProfile.id);
    }
  } catch (e) {}
  if (memoSaveTimer) clearTimeout(memoSaveTimer);
  memoSaveTimer = setTimeout(() => { memoSaveTimer = null; saveLayout(); }, 900);
}

function createMemoTile() {
  const el = document.createElement("section");
  el.className = "widget widget--memo";
  el.dataset.widget = "memo";
  const curFont = (dashLayout.memo && dashLayout.memo.font) || "default";
  const curText = (dashLayout.memo && dashLayout.memo.text) || "";
  el.innerHTML = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <div class="memo__head">
      <span class="memo__title">메모</span>
      <select class="memo__font" aria-label="폰트 선택">
        ${MEMO_FONTS.map((f) => `<option value="${f.key}"${f.key === curFont ? " selected" : ""}>${f.label}</option>`).join("")}
      </select>
    </div>
    <textarea class="memo__text" placeholder="메모를 적어보세요…" spellcheck="false"></textarea>`;

  const ta = el.querySelector(".memo__text");
  const sel = el.querySelector(".memo__font");
  ta.value = curText;
  applyMemoFont(ta, curFont);

  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("memo");
  });
  // textarea/select 조작이 드래그·롱프레스(편집모드)와 충돌하지 않게 차단
  [ta, sel].forEach((node) => node.addEventListener("pointerdown", (e) => e.stopPropagation()));

  ta.addEventListener("input", () => {
    if (!dashLayout.memo) dashLayout.memo = { text: "", font: curFont };
    dashLayout.memo.text = ta.value;
    memoSaveDebounced();
  });
  sel.addEventListener("change", () => {
    if (!dashLayout.memo) dashLayout.memo = { text: ta.value, font: "default" };
    dashLayout.memo.font = sel.value;
    applyMemoFont(ta, sel.value);
    saveLayout();
  });
  return el;
}

/* ============================================================
 * 한줄 다짐 위젯 (오늘의 한 줄 선언). 2×2.
 * - 학생이 타이핑한 한 줄을 큰 글씨로 보여줌. 폰트는 assets/fonts/ 의 MottoFont.
 * - 내용은 dashLayout.motto.text 에 저장 (Supabase + localStorage).
 * ============================================================ */
let mottoSaveTimer = null;
function mottoSaveDebounced() {
  try {
    if (dashProfile) {
      localStorage.setItem(layoutKey(dashProfile.id), JSON.stringify(dashLayout));
      localStorage.setItem("dt_dashboard_lastid", dashProfile.id);
    }
  } catch (e) {}
  if (mottoSaveTimer) clearTimeout(mottoSaveTimer);
  mottoSaveTimer = setTimeout(() => { mottoSaveTimer = null; saveLayout(); }, 900);
}

function createMottoTile() {
  const el = document.createElement("section");
  el.className = "widget widget--motto";
  el.dataset.widget = "motto";
  const text = (dashLayout.motto && dashLayout.motto.text) || "";
  el.innerHTML = `
    <button type="button" class="widget__del" aria-label="삭제">−</button>
    <span class="motto__label">오늘의 다짐</span>
    <div class="motto__text" contenteditable="true" role="textbox" aria-label="한줄 다짐"
         data-placeholder="여기에 한 줄 다짐을 적어보세요"></div>`;

  const box = el.querySelector(".motto__text");
  box.textContent = text;

  el.querySelector(".widget__del").addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation(); removeWidget("motto");
  });
  // 드래그·롱프레스(편집모드)와 충돌 방지
  box.addEventListener("pointerdown", (e) => e.stopPropagation());
  // Enter는 줄바꿈 대신 입력 종료 → "한 줄" 유지
  box.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); box.blur(); } });
  // 붙여넣기는 평문 한 줄로
  box.addEventListener("paste", (e) => {
    e.preventDefault();
    const t = ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, t);
  });
  box.addEventListener("input", () => {
    if (!dashLayout.motto) dashLayout.motto = { text: "" };
    dashLayout.motto.text = box.textContent;
    mottoSaveDebounced();
  });
  return el;
}
