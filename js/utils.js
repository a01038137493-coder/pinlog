/*
 * utils.js
 * ------------------------------------------------------------
 * 앱 전반에서 쓰는 공통 유틸 함수 모음.
 * - 날짜 처리 (오늘, 이번 주 월요일, D-day)
 * - 달성률 계산
 * - 토스트(알림) 표시
 * - 과목/사유 목록 상수
 * ------------------------------------------------------------
 */

/* 수능 날짜 (D-day 계산용). 매년 수정하세요. 2026 수능: 2026-11-19 */
const SUNEUNG_DATE = "2026-11-19";

/* 과목 정의 — 입력/표시에 공통으로 사용 */
const SUBJECTS = [
  { key: "korean", label: "국어" },
  { key: "math", label: "수학" },
  { key: "english", label: "영어" },
  { key: "inquiry1", label: "탐구1" },
  { key: "inquiry2", label: "탐구2" },
];

/* 오늘의 한마디 (날짜별 자동 로테이션) */
const QUOTES = [
  { a: "아리스토텔레스", t: "우리는 반복하는 행동으로 만들어진다." },
  { a: "소크라테스", t: "스스로를 아는 것이 모든 공부의 시작이다." },
  { a: "플라톤", t: "배움은 영혼을 밝은 곳으로 돌리는 일이다." },
  { a: "공자", t: "멈추지 않는다면 느려도 괜찮다." },
  { a: "맹자", t: "작은 선택이 쌓여 큰 사람이 된다." },
  { a: "노자", t: "천 리 길도 한 걸음에서 시작된다." },
  { a: "장자", t: "흔들리지 않는 마음이 가장 먼 길을 간다." },
  { a: "세네카", t: "시간은 부족한 것이 아니라 흘려보내는 것이다." },
  { a: "마르쿠스 아우렐리우스", t: "오늘 할 일에 집중하는 사람이 내일을 이긴다." },
  { a: "에픽테토스", t: "내가 통제할 수 있는 것에 힘을 써라." },
  { a: "레오나르도 다빈치", t: "단순함은 깊은 노력 끝에 남는 힘이다." },
  { a: "미켈란젤로", t: "위대한 결과는 매일의 작은 수고에서 태어난다." },
  { a: "갈릴레오 갈릴레이", t: "의심하고 확인하는 사람이 더 멀리 본다." },
  { a: "아이작 뉴턴", t: "오늘의 집중은 내일의 시야를 넓힌다." },
  { a: "벤저민 프랭클린", t: "오늘을 준비한 사람이 내일을 덜 두려워한다." },
  { a: "칸트", t: "스스로 생각하는 용기가 배움의 시작이다." },
  { a: "괴테", t: "할 수 있다고 믿는 순간 행동은 시작된다." },
  { a: "니체", t: "넘어짐은 끝이 아니라 더 강한 나를 만드는 과정이다." },
  { a: "쇼펜하우어", t: "조용히 견디는 힘이 결국 차이를 만든다." },
  { a: "루소", t: "배움은 남을 따라가는 일이 아니라 나를 깨우는 일이다." },
  { a: "링컨", t: "오늘의 최선이 내일의 가능성을 만든다." },
  { a: "처칠", t: "포기하지 않는 태도는 재능보다 오래 간다." },
  { a: "루스벨트", t: "할 수 있다고 믿는 마음이 절반의 길을 연다." },
  { a: "헬렌 켈러", t: "어둠 속에서도 앞으로 가는 사람이 빛을 만난다." },
  { a: "마더 테레사", t: "작은 일도 성실히 하면 삶은 달라진다." },
  { a: "간디", t: "미래는 오늘 무엇을 하느냐에 달려 있다." },
  { a: "만델라", t: "끝나기 전까지는 늘 불가능해 보인다." },
  { a: "마틴 루터 킹 주니어", t: "계단 전체가 보이지 않아도 첫걸음은 내딛어라." },
  { a: "스티브 잡스", t: "오래 버티는 힘은 좋아하는 이유에서 나온다." },
  { a: "빌 게이츠", t: "꾸준한 개선이 가장 현실적인 성장이다." },
  { a: "아인슈타인", t: "중요한 것은 질문을 멈추지 않는 것이다." },
  { a: "마리 퀴리", t: "두려움보다 이해하려는 마음이 먼저다." },
  { a: "에디슨", t: "실패는 다시 시도할 방법을 알려준다." },
  { a: "테슬라", t: "집중은 보이지 않는 가능성을 현실로 바꾼다." },
  { a: "다윈", t: "살아남는 것은 가장 꾸준히 적응하는 사람이다." },
  { a: "파스퇴르", t: "준비된 사람에게 기회는 더 자주 보인다." },
  { a: "파인만", t: "이해했다면 스스로 설명할 수 있어야 한다." },
  { a: "칼 세이건", t: "작은 호기심이 큰 세계를 연다." },
  { a: "제인 구달", t: "매일의 행동은 작아 보여도 방향을 만든다." },
  { a: "스티븐 호킹", t: "한계보다 중요한 것은 계속 생각하는 힘이다." },
  { a: "톨스토이", t: "오늘의 성실함이 삶의 방향을 바꾼다." },
  { a: "도스토옙스키", t: "고통을 견디는 시간도 나를 만든다." },
  { a: "빅토르 위고", t: "꾸준히 나아가는 사람에게 길은 열린다." },
  { a: "헤르만 헤세", t: "자신에게 이르는 길은 매일의 선택으로 이어진다." },
  { a: "셰익스피어", t: "준비된 마음은 흔들림 속에서도 길을 찾는다." },
  { a: "버지니아 울프", t: "자기만의 시간을 지키는 사람이 자기 삶을 만든다." },
  { a: "카프카", t: "길은 걸어가는 동안 조금씩 드러난다." },
  { a: "알베르 카뮈", t: "견디는 사람은 자기 안의 힘을 발견한다." },
  { a: "생텍쥐페리", t: "중요한 것은 눈에 보이는 결과보다 보이지 않는 방향이다." },
  { a: "파울로 코엘료", t: "진심으로 원하는 일은 오늘의 행동으로 증명된다." },
];
/* 날짜 기반 결정적 선택 (하루 동안 고정, 매일 바뀜) */
function todaysQuote() {
  const d = new Date(getTodayString());
  const dayNum = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[((dayNum % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

/* 학습 시간 블록 (시간 직접 입력 대신 고정 블록 선택) */
const STUDY_BLOCKS = [
  { key: "morning", label: "오전", start: "09:00", end: "12:00" },
  { key: "after_lunch", label: "점심 직후", start: "13:00", end: "14:30" },
  { key: "afternoon", label: "오후", start: "14:30", end: "17:30" },
  { key: "evening", label: "저녁", start: "19:00", end: "22:00" },
];
function blockLabel(key) {
  const b = STUDY_BLOCKS.find((x) => x.key === key);
  return b ? b.label : "";
}
function subjectLabel(key) {
  const s = SUBJECTS.find((x) => x.key === key);
  return s ? s.label : "";
}

/* 컨디션 1~10 점 표현 */
const LOW_CONDITION_MAX = 4; // 이 값 이하면 '저조'
const CONDITION_WORDS = {
  10: "최상", 9: "매우 좋음", 8: "좋음", 7: "괜찮음", 6: "보통",
  5: "애매함", 4: "나쁨", 3: "많이 나쁨", 2: "매우 나쁨", 1: "최악",
};
function conditionText(score) {
  return CONDITION_WORDS[Math.max(1, Math.min(10, Math.round(Number(score) || 0)))] || "보통";
}
function conditionFace(score) {
  const s = Math.round(Number(score) || 0);
  if (s <= 2) return "😣";
  if (s <= 4) return "😟";
  if (s === 5) return "😐";
  if (s === 6) return "🙂";
  if (s <= 8) return "😊";
  return "😄";
}

/* 핵심 과제 완료 상태 (completed=1, partial=0.5, missed=0) */
const TASK_STATUS = {
  completed: { label: "완료", score: 1 },
  partial: { label: "일부 완료", score: 0.5 },
  missed: { label: "미완료", score: 0 },
};

/* 체크아웃 미완료 사유 선택지 */
const FAILURE_REASONS = [
  "목표를 과하게 잡음",
  "예상보다 문제가 어려움",
  "개념 이해 부족",
  "오답 정리에 시간 초과",
  "졸음/컨디션 저하",
  "집중력 저하",
  "과목 회피",
  "질문 해결 지연",
  "외부 일정",
  "계획 변경",
  "기타",
];

/* 로컬 기준 오늘 날짜를 YYYY-MM-DD 로 반환 */
function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* 특정 날짜가 속한 주의 월요일을 YYYY-MM-DD 로 반환 (주 시작 = 월요일) */
function getWeekStartDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  const day = date.getDay(); // 0=일, 1=월 ... 6=토
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 지난 월요일
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* 오늘 요일 숫자 (0=일 ... 6=토) */
function getTodayWeekday() {
  return new Date().getDay();
}

/* 수능까지 남은 일수 (D-day). 음수면 지난 것 */
function getDdayToSuneung() {
  const today = new Date(getTodayString());
  const target = new Date(SUNEUNG_DATE);
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/* 날짜를 'M월 D일 (요일)' 형식으로 보기 좋게 */
function formatKoreanDate(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

/*
 * 하루 목표 달성률 계산.
 * planned 가 0이면 0 으로 처리한다. 반환값은 정수 % (반올림).
 */
function calcAchievementRate(actualTotalHours, plannedTotalHours) {
  const planned = Number(plannedTotalHours) || 0;
  const actual = Number(actualTotalHours) || 0;
  if (planned <= 0) return 0;
  return Math.round((actual / planned) * 100);
}

/* 화면 표시는 최대 150% 까지만 (시각적 게이지 등) */
function clampRateForDisplay(rate) {
  return Math.min(Number(rate) || 0, 150);
}

/* 과제 완료율 = 완료 task / 입력된 task * 100 */
function calcTaskCompletionRate(tasks, dones) {
  const inputCount = tasks.filter((t) => t && t.trim() !== "").length;
  if (inputCount === 0) return 0;
  const doneCount = dones.filter(Boolean).length;
  return Math.round((doneCount / inputCount) * 100);
}

/* 숫자 입력값을 안전하게 number 로 (빈 값/NaN 은 0) */
function toNumber(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/*
 * 화면 하단에 잠깐 떴다 사라지는 토스트 메시지.
 * type: 'success' | 'error' | 'info'
 */
function showToast(message, type = "info") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "toast";
  }, 2600);
}

/* 달성률에 따른 색상 클래스 (성공=초록, 보통=네이비, 경고=주황) */
function rateColorClass(rate) {
  if (rate >= 80) return "rate-good";
  if (rate >= 50) return "rate-mid";
  return "rate-low";
}

/* ============================================================
 * 로딩 스플래시 제어 (모든 페이지 공용)
 * ------------------------------------------------------------
 * - 페이지에 #app-loader 가 있으면 데이터 준비 후 hideAppLoader() 호출로 부드럽게 제거.
 * - 너무 빨리 끝나면 깜빡이므로 최소 노출시간(MIN) 보장.
 * - 명시적 호출이 없을 때를 대비한 안전장치(타임아웃)도 둔다.
 * ============================================================ */
window.__loaderStart = window.__loaderStart || Date.now();

function hideAppLoader() {
  const el = document.getElementById("app-loader");
  if (!el || el.classList.contains("is-hidden")) return;
  const MIN = 350; // 최소 노출(ms) — 순간 깜빡임 방지
  const wait = Math.max(0, MIN - (Date.now() - window.__loaderStart));
  setTimeout(() => {
    el.classList.add("is-hidden");
    setTimeout(() => el.remove(), 500); // opacity 트랜지션 후 DOM 제거
  }, wait);
}
window.hideAppLoader = hideAppLoader;

/* 안전장치: 6초 내 명시적 종료가 없으면 강제로 로더 제거(멈춤 방지) */
setTimeout(hideAppLoader, 6000);

/* ============================================================
 * 전체화면 토글 (페이지에 #fsBtn 있으면 자동 연결)
 * - 로그는 반응형이라 풀스크린 시 화면을 자연스럽게 꽉 채움.
 * - Esc 또는 버튼으로 해제.
 * ============================================================ */
function setupFullscreen() {
  const btn = document.getElementById("fsBtn");
  if (!btn) return;
  const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  btn.addEventListener("click", () => {
    if (isFs()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  });
  const sync = () => {
    const on = !!isFs();
    btn.title = on ? "전체화면 종료" : "전체화면";
    btn.classList.toggle("is-fs", on);
  };
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
}
if (document.readyState !== "loading") setupFullscreen();
else document.addEventListener("DOMContentLoaded", setupFullscreen);


/* ============================================================
 * 사용자 유형 (exam=수험생 / general=일반)
 *  - 수험생: 수능 D-Day 고정 사용
 *  - 일반:   profiles.goal_date 를 쓰고, 없으면 D-Day 미표시
 * ============================================================ */
function isGeneral(profile) {
  return profile && profile.user_type === "general";
}

/* 유형에 맞는 D-Day 정보. 표시할 게 없으면 null */
function ddayFor(profile) {
  if (isGeneral(profile)) {
    if (!profile.goal_date) return null;
    const today = new Date(getTodayString());
    const diff = Math.round((new Date(profile.goal_date) - today) / (1000 * 60 * 60 * 24));
    return { label: profile.goal_label || "목표", days: diff };
  }
  return { label: "수능", days: getDdayToSuneung() };
}

/* D-Day 숫자를 'D-12' / 'D-DAY' / 'D+3' 로 */
function ddayText(days) {
  return days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : `D+${Math.abs(days)}`;
}

/* 유형별 용어 (일반 사용자는 학습 용어 대신 중립적인 말) */
function terms(profile) {
  return isGeneral(profile)
    ? { plan: "오늘 할 일", planCta: "오늘 할 일 정하기", result: "하루 마무리", resultCta: "하루 마무리하기", task: "할 일" }
    : { plan: "오늘 플랜", planCta: "오늘 플랜 만들기", result: "오늘 성과", resultCta: "성과 기록하기", task: "과제" };
}

/* 12시간제 시각 표시: "오후 3:05" */
function fmtTime12(d) {
  const h = d.getHours(), m = d.getMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return ampm + " " + h12 + ":" + String(m).padStart(2, "0");
}

/* ============================================================
 * Share Extension 연동: 공유 시트로 받은 스크린샷이 App Group 에
 * 남아 있으면 꺼내서 캘린더의 일정 인식 흐름으로 넘긴다.
 * ============================================================ */
async function checkSharedScreenshot() {
  try {
    const viz = window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.VisionOCR : null;
    if (!viz || !viz.takeSharedScreenshot) return;
    const { base64 } = await viz.takeSharedScreenshot();
    if (!base64) return;
    sessionStorage.setItem("dt_shared_shot", base64);
    if (location.pathname !== "/calendar.html") {
      window.location.href = "/calendar.html";
    } else if (window.__dtHandleSharedShot) {
      window.__dtHandleSharedShot();
    }
  } catch (e) {}
}
/* 공유 시트로 받은 일반 파일 → 파일 페이지에서 자동 저장 */
async function checkSharedFile() {
  try {
    const viz = window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.VisionOCR : null;
    if (!viz || !viz.hasSharedFile) return;
    const { pending } = await viz.hasSharedFile();
    if (!pending) return;
    if (location.pathname !== "/files.html") {
      window.location.href = "/files.html";
    } else if (window.__dtHandleSharedFile) {
      window.__dtHandleSharedFile();
    }
  } catch (e) {}
}

/* 공유 시트로 받은 텍스트 → 캘린더에서 일정 자동 인식 */
async function checkSharedText() {
  try {
    const viz = window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.VisionOCR : null;
    if (!viz || !viz.hasSharedText) return;
    const { pending } = await viz.hasSharedText();
    if (!pending) return;
    const { text } = await viz.takeSharedText();
    if (!text || !String(text).trim()) return;
    sessionStorage.setItem("dt_shared_text", String(text));
    if (location.pathname !== "/calendar.html") {
      window.location.href = "/calendar.html";
    } else if (window.__dtHandleSharedText) {
      window.__dtHandleSharedText();
    }
  } catch (e) {}
}
function dtCheckShared() { checkSharedScreenshot(); checkSharedFile(); checkSharedText(); }
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) dtCheckShared();
});
if (document.readyState !== "loading") dtCheckShared();
else document.addEventListener("DOMContentLoaded", dtCheckShared);

/* ============================================================
 * 핀로그 일정 (Supabase events — 계정 동기화)
 * 반복 일정(daily/weekly/monthly/yearly)을 기간 안의 발생일로 확장해
 * {src:"pin", id, title, startDate, endDate, isAllDay, alertMin, repeat} 로 반환
 * ============================================================ */
async function dtPinEventsInRange(userId, fromMs, toMs) {
  const out = [];
  try {
    const isoFrom = new Date(fromMs).toISOString();
    const isoTo = new Date(toMs).toISOString();
    const [one, rep] = await Promise.all([
      supabaseClient.from("events").select("*").eq("user_id", userId)
        .is("repeat", null).gte("start_at", isoFrom).lte("start_at", isoTo),
      supabaseClient.from("events").select("*").eq("user_id", userId)
        .not("repeat", "is", null),
    ]);
    const norm = (ev, startMs) => {
      const dur = ev.end_at ? (new Date(ev.end_at) - new Date(ev.start_at)) : 3600000;
      return { src: "pin", id: ev.id, title: ev.title, startDate: startMs, endDate: startMs + dur,
               isAllDay: !!ev.all_day, alertMin: ev.alert_min, repeat: ev.repeat || "" };
    };
    (one.data || []).forEach((ev) => out.push(norm(ev, new Date(ev.start_at).getTime())));
    for (const ev of (rep.data || [])) {
      const base = new Date(ev.start_at);
      const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
      for (let t = fromMs; t <= toMs; t += 86400000) {
        const d = new Date(t);
        const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (day0.getTime() < baseDay) continue;
        const hit =
          ev.repeat === "daily" ||
          (ev.repeat === "weekly" && day0.getDay() === base.getDay()) ||
          (ev.repeat === "monthly" && day0.getDate() === base.getDate()) ||
          (ev.repeat === "yearly" && day0.getDate() === base.getDate() && day0.getMonth() === base.getMonth());
        if (hit) out.push(norm(ev, new Date(d.getFullYear(), d.getMonth(), d.getDate(), base.getHours(), base.getMinutes()).getTime()));
      }
    }
  } catch (e) {}
  return out;
}

/* ============================================================
 * 홈 일정 블록: 오늘 일정 + 다가오는 일정(7일)
 * 핀로그 일정(계정 동기화) + Apple 캘린더(기기, 앱 전용) 병합
 * ============================================================ */
async function renderHomeSchedule(sectionEl, listEl) {
  try {
    if (!sectionEl || !listEl) return;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);

    let events = [];
    const profile = await getCurrentProfile();
    if (profile) events = await dtPinEventsInRange(profile.id, dayStart.getTime(), rangeEnd.getTime());

    const calPlugin = window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.CapacitorCalendar : null;
    if (calPlugin) {
      try {
        const { result: perm } = await calPlugin.requestFullCalendarAccess();
        if (perm === "granted") {
          const { result } = await calPlugin.listEventsInRange({
            from: dayStart.getTime(), to: rangeEnd.getTime(),
          });
          const dup = new Set(events.map((p) => (p.title || "") + "|" + Math.round(p.startDate / 60000)));
          events = events.concat((result || []).filter((ev) =>
            !dup.has((ev.title || "") + "|" + Math.round(ev.startDate / 60000))));
        }
      } catch (e) {}
    }
    events.sort((a, b) => a.startDate - b.startDate);
    if (!events.length) return;
    window.__dtHomeEvents = events;   // 홈 일정 상세 패널용

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const dows = ["일", "월", "화", "수", "목", "금", "토"];
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();

    const dateLabel = (ev) => {
      const d = new Date(ev.startDate);
      const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - dayStart) / 86400000);
      if (diff === 1) return "내일";
      return `${d.getMonth() + 1}/${d.getDate()} (${dows[d.getDay()]})`;
    };
    const timeText = (ev) => ev.isAllDay ? "종일" : fmtTime12(new Date(ev.startDate));

    const todays = events.filter((ev) => ev.startDate <= todayEnd);
    const upcoming = events.filter((ev) => ev.startDate > todayEnd).slice(0, 5);

    let html = "";
    if (todays.length) {
      html += `<p class="msection-title">오늘 일정</p>`;
      html += todays.slice(0, 4).map((ev) =>
        `<div class="fcal-ev" data-hev="${events.indexOf(ev)}"><span class="fcal-ev__time">${timeText(ev)}</span><span class="fcal-ev__title">${esc(ev.title || "(제목 없음)")}</span></div>`
      ).join("");
    }
    if (upcoming.length) {
      html += `<p class="msection-title">다가오는 일정</p>`;
      html += upcoming.map((ev) =>
        `<div class="fcal-ev" data-hev="${events.indexOf(ev)}"><span class="fcal-ev__time">${dateLabel(ev)}</span><span class="fcal-ev__title">${esc(ev.title || "(제목 없음)")}<span class="fcal-ev__sub"> · ${timeText(ev)}</span></span></div>`
      ).join("");
    }
    html += `<a href="/calendar.html" class="mtoday__more">캘린더에서 전체 보기</a>`;
    listEl.innerHTML = html;
    sectionEl.hidden = false;
  } catch (e) {}
}

/* ============================================================
 * 키보드 리사이즈 모드 — body[data-kbresize]로 페이지별 선택 (기본 native)
 * "none" 페이지는 시트를 --kb 만큼 transform 으로 올려 키보드와 동시에 움직인다
 * ============================================================ */
(function () {
  try {
    const K = window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Keyboard : null;
    if (!K || !K.setResizeMode) return;
    const mode = (document.body && document.body.dataset.kbresize) || "native";
    K.setResizeMode({ mode });

    // 키보드가 떠 있는 동안 하단 탭바 숨김 (키보드 위에 떠 보이는 것 방지)
    K.addListener("keyboardWillShow", () => document.body.classList.add("kb-up"));
    K.addListener("keyboardWillHide", () => document.body.classList.remove("kb-up"));

    if (mode !== "none") return;

    // 들어올림 = 네이티브 키보드 이벤트의 실제 높이.
    // 텍스트 입력은 탭 즉시 직전 높이로 선반응(브리지 지연 제거)하되,
    // 키보드가 실제로 안 뜨면(날짜 휠 등) 0.6초 뒤 자동 원복한다.
    const root = document.documentElement;
    const setKb = (h) => root.style.setProperty("--kb", h + "px");

    // 키보드 뒤 배경 마스크 — iOS 키보드 상단 라운딩 틈으로 비치는 배경을 키보드색으로 통일
    const kbMask = document.createElement("div");
    kbMask.className = "dt-kbmask";
    document.body.appendChild(kbMask);
    const TEXTUAL = /^(text|search|email|password|tel|url|number)$/;
    let kbShown = false, guard = null;
    const isTextField = (el) => el && el.closest && el.closest(".evsheet__panel") &&
      (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && TEXTUAL.test(el.type || "text")));

    document.addEventListener("focusin", (e) => {
      if (!isTextField(e.target)) return;
      document.body.classList.add("kb-open");
      setKb(Number(localStorage.getItem("dt_kb_h")) || 300);
      clearTimeout(guard);
      guard = setTimeout(() => {
        if (!kbShown) { setKb(0); document.body.classList.remove("kb-open"); }
      }, 600);
    });
    K.addListener("keyboardWillShow", (e) => {
      kbShown = true;
      const h = (e && e.keyboardHeight) || 0;
      if (h) localStorage.setItem("dt_kb_h", String(h));
      document.body.classList.add("kb-open");
      setKb(h);
    });
    K.addListener("keyboardWillHide", () => {
      kbShown = false;
      document.body.classList.remove("kb-open");
      setKb(0);
    });
  } catch (e) {}
})();

/* 웹(브라우저) 구분 클래스 — 데스크톱 웹앱 레이아웃(좌측 사이드바)용 */
(function () {
  try {
    const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (!native) {
      document.documentElement.classList.add("dt-web");
      if (document.body) document.body.classList.add("dt-web");
    }
  } catch (e) {}
})();

/* 아바타 표시 — 프로필 사진이 있으면 사진, 없으면 이름 첫 글자 */
function dtPaintAvatar(el, profile) {
  if (!el) return;
  if (profile && profile.avatar_url) {
    el.textContent = "";
    el.classList.add("has-img");
    el.style.backgroundImage = "url('" + profile.avatar_url + "')";
  } else {
    el.classList.remove("has-img");
    el.style.backgroundImage = "";
    el.textContent = (((profile && profile.name) || "?").trim().charAt(0)) || "?";
  }
}

/* 폴더(카테고리) 색상 팔레트 — 탭할 때마다 순환 */
const CAT_COLORS = ["#8e8e93", "#f04438", "#ff9f0a", "#f5c518", "#12b76a", "#2e90fa", "#7a5af8", "#ee46bc"];

/* 데이터 로딩이 250ms 이상 걸리고 목록이 아직 비어있을 때만 스켈레톤 표시.
 * 반환된 함수를 데이터 도착 시 호출해 취소한다. */
function dtSkeleton(el, rows) {
  if (!el) return function () {};
  const t = setTimeout(function () {
    if (el.querySelector(".memo-row, .gtodo__row, .fcal-ev")) return;  // 이미 내용 있으면 유지
    let html = "";
    for (let i = 0; i < (rows || 3); i++) html += '<div class="skel"></div>';
    el.innerHTML = html;
  }, 250);
  return function () { clearTimeout(t); };
}

/* ============================================================
 * 페이지 전환 페이드 — 깜빡임을 애니메이션으로 감춘다.
 * 나갈 때: 링크 이동을 가로채 0.11초 페이드아웃 후 이동
 * 들어올 때: body 가 0.16초 페이드인
 * ============================================================ */
(function () {
  try {
    // 크로스 도큐먼트 뷰 트랜지션 지원(iOS 18.2+): 이전 화면 스냅샷이 새 화면으로
    // 끊김 없이 크로스페이드되므로 JS 페이드(화면을 먼저 비워 깜빡임 유발)를 쓰지 않는다.
    const vt = "startViewTransition" in document;
    const style = document.createElement("style");
    style.textContent =
      (vt ? "" :
        "body { animation: dt-page-in 0.16s ease both; }" +
        "@keyframes dt-page-in { from { opacity: 0; } }" +
        "body.dt-leaving { opacity: 0; transition: opacity 0.11s ease; animation: none; }") +
      "@keyframes dt-page-up { from { transform: translateY(10%); opacity: 0; } }";
    document.head.appendChild(style);

    // 플로팅 + 버튼으로 진입한 화면은 아래에서 위로 열리는 전환
    if (sessionStorage.getItem("dt_nav_up")) {
      sessionStorage.removeItem("dt_nav_up");
      document.body.style.animation = "dt-page-up 0.28s cubic-bezier(.22,.61,.36,1) both";
    }

    // 뒤로가기(bfcache) 복원 시 떠날 때의 투명 상태 해제 — 흰 화면 방지
    window.addEventListener("pageshow", () => {
      document.body.classList.remove("dt-leaving");
    });

    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || href.indexOf("http") === 0 ||
          href.indexOf("javascript:") === 0 || a.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.defaultPrevented) return;
      if (a.classList.contains("fab") || a.classList.contains("fabmenu__item")) sessionStorage.setItem("dt_nav_up", "1");
      if (vt) return;                       // 뷰 트랜지션이 전환을 맡음 — 기본 내비게이션 그대로
      e.preventDefault();
      document.body.classList.add("dt-leaving");
      setTimeout(() => { window.location.href = href; }, 110);
    }, true);
  } catch (e) {}
})();

/* 왼쪽 가장자리에서 오른쪽 스와이프 → 뒤로가기 (뒤로가기 버튼이 있는 화면) — dt-edge-back
 * 앱에서는 WKWebView 네이티브 제스처(이전 화면이 실시간으로 따라 보임)가 담당하므로 웹 폴백만 */
(function () {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;
  const backEl = document.querySelector(".topbar__back, .auth-back");
  if (!backEl) return;
  let sx = null, sy = 0;
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    sx = t.clientX <= 30 ? t.clientX : null;
    sy = t.clientY;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    sx = null;
    if (dx > 70 && dx > dy * 1.5) backEl.click();
  }, { passive: true });
})();

/* 웹 데스크톱: 사이드바 상단 "새로 만들기" 버튼 + 빠른 생성 메뉴 — dt-sb-new */
(function () {
  try {
    const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (native) return;
    const bar = document.querySelector(".tabbar");
    if (!bar) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sb-new";
    btn.innerHTML = "＋ 새로 만들기";
    const menu = document.createElement("div");
    menu.className = "sb-newmenu";
    menu.hidden = true;
    menu.innerHTML = [
      '<a href="/general.html?newtodo=1">✓ 할 일 추가</a>',
      '<a href="/calendar.html?new=1">🗓 일정 추가</a>',
      '<a href="/memo-edit.html">✏️ 새 메모</a>',
      '<a href="/files.html?upload=1">📁 파일 업로드</a>',
    ].join("");
    bar.appendChild(btn);      // 설정(마지막 메뉴) 아래
    bar.appendChild(menu);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 8) + "px";
      menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => { menu.hidden = true; });
  } catch (e) {}
})();

/* 수험생 모드: 하단 탭의 캘린더를 타임박스로 교체 — dt-exam-tab */
(function () {
  try {
    const cached = JSON.parse(localStorage.getItem("dt_profile_cache") || "null");
    if (!cached || cached.user_type !== "exam") return;
    const a = document.querySelector('.tabbar a[href="/calendar.html"]');
    if (!a) return;
    a.setAttribute("href", "/timebox.html");
    const label = a.querySelector("span");
    if (label) label.textContent = "타임박스";
    const svg = a.querySelector("svg");
    if (svg) svg.innerHTML = '<circle cx="12" cy="13" r="8"/><path d="M12 10v3l2 2"/><path d="M9 2h6"/>';
    if (location.pathname === "/timebox.html") a.classList.add("is-active");
  } catch (e) {}
})();


/* 시간대별 친근한 인사말 (모바일 홈 헤더용) */
function dtGreeting(name) {
  const h = new Date().getHours();
  let msg;
  if (h >= 1 && h < 5) msg = "새벽까지 수고하십니다.. 무리하지 마세요!";
  else if (h >= 5 && h < 8) msg = "일찍 시작하는 하루네요! 오늘도 화이팅 ☀️";
  else if (h >= 8 && h < 11) msg = "좋은 아침이에요! 가볍게 시작해봐요";
  else if (h >= 11 && h < 13) msg = "오늘 점심 메뉴는 뭐예요? ㅎㅎ";
  else if (h >= 13 && h < 17) msg = "나른한 오후네요, 잠깐 스트레칭 어때요?";
  else if (h >= 17 && h < 19) msg = "오늘 하루도 수고 많았어요!";
  else if (h >= 19 && h < 22) msg = "하루 마무리 잘 하고 있나요? 🌙";
  else msg = "슬슬 잘 준비 해볼까요? 😴";
  const who = name ? String(name).trim() : "";
  return (who ? who + "님, " : "") + msg;
}

/* ------------------------------------------------------------
 * 요약 카드 상황 리마인더 — 비 예보 / 내일 이른 첫 일정.
 * 해당 없으면 null (진행률 기본 문구 사용). 날씨는 30분 캐시.
 * ------------------------------------------------------------ */
async function dtSmartSub(profile) {
  const h = new Date().getHours();
  const evening = h >= 18 || h < 4;

  const earlyEvent = async () => {
    try {
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const s = new Date(t0.getTime() + 86400000);
      const e = new Date(t0.getTime() + 2 * 86400000);
      const { data } = await supabaseClient.from("events")
        .select("start_at,all_day").eq("user_id", profile.id)
        .gte("start_at", s.toISOString()).lt("start_at", e.toISOString())
        .order("start_at").limit(3);
      const ev = (data || []).find((x) => !x.all_day);
      if (!ev) return null;
      const st = new Date(ev.start_at);
      if (st.getHours() > 9) return null;
      return `내일 ${fmtTime12(st)} 일정이 있어요. 내일을 위해 일찍 쉬어요 🌙`;
    } catch (e2) { return null; }
  };

  const rainToday = async () => {
    try {
      const KEY = "dt_wx_rain";
      let p = null;
      try {
        const c = JSON.parse(localStorage.getItem(KEY) || "null");
        if (c && Date.now() - c.t < 30 * 60000) p = c.p;
      } catch (e2) {}
      if (p === null) {
        let lat = 37.57, lon = 126.98;                      // 실패 시 서울
        try {
          const g = await (await fetch("https://ipwho.is/")).json();
          if (g && g.success !== false && typeof g.latitude === "number") { lat = g.latitude; lon = g.longitude; }
        } catch (e2) {}
        const d = await (await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=precipitation_probability_max,weather_code&forecast_days=1&timezone=auto`)).json();
        const code = d.daily && d.daily.weather_code ? d.daily.weather_code[0] : 0;
        const prob = d.daily && d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[0] : 0;
        p = prob >= 60 || (code >= 51 && code <= 99);       // WMO 51+: 비·소나기·뇌우·눈
        localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), p }));
      }
      return p ? "오늘 비 소식이 있어요. 우산 챙기는 거 잊지 마세요 ☔" : null;
    } catch (e2) { return null; }
  };

  // 저녁·새벽엔 내일 일정 안내가 먼저, 낮에는 우산 리마인더가 먼저
  const order = evening ? [earlyEvent, rainToday] : [rainToday, earlyEvent];
  for (const f of order) { const s = await f(); if (s) return s; }
  return null;
}

/* ------------------------------------------------------------
 * 전역 오프라인 배너 — 연결이 끊기면 상단에 안내, 복구되면 자동 제거
 * ------------------------------------------------------------ */
(function () {
  let bar = null;
  function show() {
    if (bar || !document.body) return;
    bar = document.createElement("div");
    bar.className = "dt-offline";
    bar.textContent = "오프라인 상태예요 — 연결되면 자동으로 이어집니다";
    document.body.appendChild(bar);
  }
  function hide() { if (bar) { bar.remove(); bar = null; } }
  window.addEventListener("offline", show);
  window.addEventListener("online", hide);
  document.addEventListener("DOMContentLoaded", () => { if (navigator.onLine === false) show(); });
})();
