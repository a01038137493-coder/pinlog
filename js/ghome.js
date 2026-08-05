/*
 * ghome.js — 일반 사용자 모바일 홈 (심플 투두 플래너)
 * ------------------------------------------------------------
 * general-m.html 전용. 수험생 홈(mhome.js)·태블릿 홈(gtab.js)과 완전히 분리.
 * - 오늘 할 일: ＋ 작성 시트(날짜·중요), 탭=완료, 스와이프=중요·삭제
 *   중요 항목 상단, 완료 항목 하단 정렬. 오늘 이후 날짜는 "예정" 카드로.
 * - 어제 미완료 → "가져오기" 한 번으로 오늘로 이월
 * - 목표 D-Day(goal_date, 설정 시에만) + 일정 블록(Apple 캘린더)
 * ------------------------------------------------------------ */
(function () {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
  const DEL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>`;

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("g-date").textContent = formatKoreanDate();
    try {
      const greetEl = document.getElementById("g-greet");
      if (greetEl) { greetEl.textContent = dtGreeting(null); greetEl.hidden = false; }
    } catch (e) {}

    const profile = await requireRole(["student"]);
    if (!profile) return;
    try { document.getElementById("g-greet").textContent = dtGreeting(profile.name); } catch (e) {}
    if (!profile.onboarded) { window.location.replace("/onboarding.html"); return; }
    // 수험생이 잘못 들어오면 수험생 홈으로
    if (profile.user_type !== "general") { window.location.replace("/student-m.html"); return; }

    /* 목표 D-Day (설정한 경우에만) */
    const dd = ddayFor(profile);
    if (dd) {
      const el = document.getElementById("g-dday");
      el.innerHTML = `${esc(dd.label)} <b>${ddayText(dd.days)}</b>`;
      el.hidden = false;
    }

    const today = getTodayString();
    const shiftDate = (base, days) => {
      const [y, m, d] = base.split("-").map(Number);
      const t = new Date(y, m - 1, d + days);
      return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    };
    const yesterday = shiftDate(today, -1);
    const tomorrow = shiftDate(today, 1);

    const listEl = document.getElementById("g-list");
    const countEl = document.getElementById("g-count");
    const upCard = document.getElementById("g-upcoming");
    const upListEl = document.getElementById("g-upcoming-list");
    let todos = [];        // 오늘
    let upcoming = [];     // 오늘 이후
    let carryover = [];

    const findTodo = (id) =>
      todos.find((t) => t.id === id) || upcoming.find((t) => t.id === id);

    const dateLabel = (dateStr) => {
      if (dateStr === tomorrow) return dtT("내일", "Tomorrow");
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return `${m}/${d} (${["일", "월", "화", "수", "목", "금", "토"][dt.getDay()]})`;
    };

    /* ---------- 렌더 ---------- */
    const rowHtml = (t, dateLbl) => `
      <div class="gtodo__row memo-row" data-id="${t.id}">
        <div class="memo-row__actions">
          <button type="button" class="memo-act memo-act--imp" data-act="imp">${STAR_SVG}<span>${dtT("중요", "Star")}</span></button>
          <button type="button" class="memo-act memo-act--del" data-act="del">${DEL_SVG}<span>${dtT("삭제", "Delete")}</span></button>
        </div>
        <button type="button" class="gtodo__item${t.done ? " is-done" : ""}">
          <span class="gtodo__check">${t.done ? "✓" : ""}</span>
          ${dateLbl ? `<span class="gup-date">${dateLbl}</span>` : ""}
          ${t.important ? `<span class="gtodo__star">★</span>` : ""}
          <span class="gtodo__text">${esc(t.content)}</span>
          ${tagHtml(t)}
          ${t.remind_time || t.note ? `<span class="gtodo__flag">${t.remind_time ? "⏰" + fmtRemind(t.remind_time) : ""}${t.note ? (t.remind_time ? " " : "") + "📝" : ""}</span>` : ""}
        </button>
      </div>`;

    function render() {
      const done = todos.filter((t) => t.done).length;
      countEl.hidden = todos.length === 0;
      countEl.textContent = done + "/" + todos.length + dtT(" 완료", " done");

      if (!todos.length) {
        listEl.innerHTML = `<p class="gtodo__empty">${dtT("오늘 할 일을 적어보세요", "Write down what you'll do today")}</p>`;
        return;
      }
      // 미완료 먼저(그 안에서 중요 먼저) → 완료는 맨 아래
      const sorted = [...todos].sort((a, b) =>
        (a.done === b.done ? 0 : a.done ? 1 : -1) ||
        ((b.important ? 1 : 0) - (a.important ? 1 : 0)) ||
        (a.sort - b.sort) ||
        String(a.created_at).localeCompare(String(b.created_at)));
      listEl.innerHTML = sorted.map((t) => rowHtml(t, null)).join("");
      listEl.querySelectorAll(".gtodo__row").forEach(wireRow);
    }

    function renderUpcoming() {
      upCard.hidden = upcoming.length === 0;
      if (!upcoming.length) return;
      const sorted = [...upcoming].sort((a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        ((b.important ? 1 : 0) - (a.important ? 1 : 0)) ||
        String(a.created_at).localeCompare(String(b.created_at)));
      upListEl.innerHTML = sorted.map((t) => rowHtml(t, dateLabel(t.date))).join("");
      upListEl.querySelectorAll(".gtodo__row").forEach(wireRow);
    }

    let smartSub = null;   // 상황 리마인더 (비 예보·내일 이른 일정) — 있으면 기본 문구 대신
    function updateSummary() {
      const box = document.getElementById("g-summary");
      if (!box) return;
      const n = todos.length;
      const done = todos.filter((t) => t.done).length;
      const empty = n === 0;

      /* 할 일이 하나도 없으면 진행률 대신 시작 유도 카드로 */
      box.classList.toggle("msum--empty", empty);
      box.querySelector(".msum__ring").style.display = empty ? "none" : "";
      box.querySelector(".msum__stats").style.display = empty ? "none" : "";
      box.querySelector(".msum__label").textContent = empty ? dtT("오늘의 시작", "Start your day") : dtT("오늘의 진행률", "Today's progress");
      const titleEl = box.querySelector(".msum__title");
      if (empty) {
        titleEl.textContent = dtT("오늘 할 일을 추가해볼까요?", "Ready to add your first task?");
        document.getElementById("g-sum-sub").textContent =
          smartSub || dtT("작게 시작할수록 꾸준해져요", "Small starts build big habits");
      } else {
        const C = 188.5;
        const pct = done / n;
        titleEl.innerHTML = DT_EN ? "<em>" + done + "</em> task" + (done === 1 ? "" : "s") + " done today" : "오늘 할 일 <em>" + done + "개</em> 완료했어요";
        document.getElementById("g-sum-frac").textContent = done + "/" + n;
        document.getElementById("g-sum-left").textContent = n - done;
        document.getElementById("g-sum-imp").textContent = todos.filter((t) => t.important && !t.done).length;
        document.getElementById("g-sum-arc").style.strokeDashoffset = (C * (1 - pct)).toFixed(1);
        document.getElementById("g-sum-sub").textContent =
          pct >= 1 ? dtT("오늘 할 일을 전부 끝냈어요! 🎉", "Everything done for today! 🎉")
          : smartSub ? smartSub
          : pct >= 0.5 ? dtT("절반 넘게 왔어요, 이 흐름 그대로!", "More than halfway — keep it up!")
          : dtT("작은 시작이 큰 변화를 만듭니다", "Small steps make big changes");
      }
      box.hidden = false;

      /* iOS 잠금화면·홈 위젯에 오늘 요약 전달 */
      try {
        const WB = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()
          && Capacitor.Plugins && Capacitor.Plugins.WidgetBridge;
        if (WB) {
          /* 위젯 첫 줄: 사용자 요일 리마인더 → 상황 문구(비·내일 일정) → 남은 할 일 요약 */
          let msg = "";
          try {
            const arr = JSON.parse(localStorage.getItem("dt_lockmsg") || "[]");
            const dow = new Date().getDay();
            const hit = arr.find((r) => r && r.text && (!r.days || r.days.length >= 7 || r.days.includes(dow)));
            if (hit) msg = hit.text;
          } catch (e2) {}
          if (!msg) msg = smartSub || "";
          if (!msg) {
            msg = n === 0 ? "오늘은 여유로운 날이에요"
              : done >= n ? "오늘 할 일 모두 완료! 🎉"
              : "오늘 할 일 " + (n - done) + "개 남았어요";
          }
          WB.update({
            left: n - done, total: n, done, msg,
            items: todos.filter((t) => !t.done).slice(0, 3).map((t) => t.content),
            ev: widgetEv,
            date: today,
          });
        }
      } catch (e) {}
    }

    /* 위젯용 다음 일정 (오늘 남은 첫 일정) */
    let widgetEv = "";
    async function loadWidgetEv() {
      try {
        const e0 = new Date(); e0.setHours(24, 0, 0, 0);
        const { data } = await supabaseClient.from("events")
          .select("start_at,title,all_day").eq("user_id", profile.id)
          .gte("start_at", new Date().toISOString()).lt("start_at", e0.toISOString())
          .order("start_at").limit(1);
        const ev = (data || [])[0];
        widgetEv = ev ? (ev.all_day ? "" : fmtTime12(new Date(ev.start_at)) + " ") + ev.title : "";
        if (widgetEv) updateSummary();
      } catch (e) {}
    }
    loadWidgetEv();

    function renderAll() { render(); renderUpcoming(); updateSummary(); }

    /* 행 하나: 탭=완료 토글, 좌측 스와이프=중요·삭제 */
    let openRow = null;
    const OPEN_X = -150;
    function closeOpen() {
      if (!openRow) return;
      openRow.classList.remove("is-open");
      openRow.querySelector(".gtodo__item").style.transform = "";
      openRow = null;
    }
    function wireRow(row) {
      const card = row.querySelector(".gtodo__item");
      let sx = 0, sy = 0, dx = 0, dir = null, active = false, moved = false;
      const setX = (x) => { card.style.transform = x ? `translateX(${x}px)` : ""; };

      card.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (openRow && openRow !== row) closeOpen();
        sx = e.clientX; sy = e.clientY; dx = 0; dir = null; active = true; moved = false;
        card.style.transition = "none";
      });
      card.addEventListener("pointermove", (e) => {
        if (!active) return;
        const mx = e.clientX - sx, my = e.clientY - sy;
        if (!dir) {
          if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
          if (Math.abs(my) > Math.abs(mx)) { active = false; return; }
          dir = "x";
          try { card.setPointerCapture(e.pointerId); } catch (err) {}
        }
        moved = true;
        const base = row.classList.contains("is-open") ? OPEN_X : 0;
        dx = Math.max(OPEN_X - 30, Math.min(0, base + mx));
        setX(dx);
      });
      const finish = () => {
        if (!active) return;
        active = false;
        card.style.transition = "";
        if (dir !== "x") return;
        if (dx < OPEN_X / 2) { setX(OPEN_X); row.classList.add("is-open"); openRow = row; }
        else { setX(0); row.classList.remove("is-open"); if (openRow === row) openRow = null; }
      };
      card.addEventListener("pointerup", finish);
      card.addEventListener("pointercancel", finish);

      card.addEventListener("click", async (e) => {
        if (moved) { moved = false; return; }
        if (row.classList.contains("is-open")) { closeOpen(); return; }
        const todo = findTodo(row.dataset.id);
        if (!todo) return;
        /* 텍스트 탭 → 메모·알림 시트 (완료 토글은 체크·여백 탭) */
        if (e.target.closest(".gtodo__text")) { openTodoSheet(todo); return; }
        todo.done = !todo.done;             // 낙관적 갱신
        renderAll();
        const { error } = await supabaseClient.from("todos")
          .update({ done: todo.done }).eq("id", todo.id);
        if (error) { todo.done = !todo.done; renderAll(); }
      });

      row.querySelector("[data-act=imp]").addEventListener("click", async () => {
        const todo = findTodo(row.dataset.id);
        if (!todo) return;
        todo.important = !todo.important;
        openRow = null;
        renderAll();
        const { error } = await supabaseClient.from("todos")
          .update({ important: todo.important }).eq("id", todo.id);
        if (error) { todo.important = !todo.important; renderAll(); }
      });

      row.querySelector("[data-act=del]").addEventListener("click", async () => {
        const id = row.dataset.id;
        const { error } = await supabaseClient.from("todos").delete().eq("id", id);
        if (!error) {
          todos = todos.filter((t) => t.id !== id);
          upcoming = upcoming.filter((t) => t.id !== id);
          openRow = null;
          renderAll();
        }
      });
    }


    /* ---------- 태그 ---------- */
    let tags = [];
    let sheetTag = null;
    const tagHtml = (t) => {
      const tg = t.tag_id && tags.find((x) => x.id === t.tag_id);
      return tg ? `<span class="gtodo__tag" style="--tagc:${tg.color || "#8e8e93"}">${esc(tg.name)}</span>` : "";
    };
    function renderSheetTags() {
      const box = document.getElementById("gt-tags");
      if (!box) return;
      box.innerHTML = tags.map((tg) =>
        `<button type="button" class="gt-tag${sheetTag === tg.id ? " is-on" : ""}" data-tag="${tg.id}" style="--tagc:${tg.color || "#8e8e93"}"><i></i>${esc(tg.name)}</button>`
      ).join("") + `<button type="button" class="gt-tag gt-tag--add" data-tag-add>＋ 태그</button>`;
      box.querySelectorAll("[data-tag]").forEach((b) =>
        b.addEventListener("click", () => {
          sheetTag = sheetTag === b.dataset.tag ? null : b.dataset.tag;
          renderSheetTags();
        }));
      box.querySelector("[data-tag-add]").addEventListener("click", () => {
        document.getElementById("gt-tagadd").hidden = false;
        document.getElementById("gt-tag-input").focus();
      });
    }
    async function createTag() {
      const input = document.getElementById("gt-tag-input");
      const name = input.value.trim();
      if (!name) return;
      const { data, error } = await supabaseClient.from("todo_tags")
        .insert({ student_id: profile.id, name, color: CAT_COLORS[(tags.length + 1) % CAT_COLORS.length], sort: tags.length })
        .select().single();
      if (!error && data) {
        tags.push(data);
        input.value = "";
        document.getElementById("gt-tagadd").hidden = true;
        sheetTag = data.id;
        renderSheetTags();
      }
    }
    document.getElementById("gt-tag-btn").addEventListener("click", createTag);
    document.getElementById("gt-tag-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); createTag(); }
    });

    /* ---------- 작성 시트 ---------- */
    const sheet = document.getElementById("gt-sheet");
    const sheetInput = document.getElementById("gt-input");
    const sheetDate = document.getElementById("gt-date");
    const impBtn = document.getElementById("gt-imp");
    let sheetWhen = "today";
    let sheetImp = false;

    function openSheet() {
      sheetInput.value = "";
      sheetWhen = "today";
      sheetImp = false;
      impBtn.classList.remove("is-on");
      sheetTag = null;
      document.getElementById("gt-tagadd").hidden = true;
      renderSheetTags();
      sheetDate.hidden = true;
      sheetDate.value = tomorrow;
      sheetDate.min = today;
      document.querySelectorAll("#gt-when .gt-chip").forEach((c) =>
        c.classList.toggle("is-active", c.dataset.when === "today"));
      sheet.hidden = false;
      setTimeout(() => sheetInput.focus({ preventScroll: true }), 60);
    }
    function closeSheet() { sheet.hidden = true; sheetInput.blur(); }

    document.getElementById("g-add-row").addEventListener("click", openSheet);
    sheet.querySelectorAll("[data-gt-close]").forEach((el) =>
      el.addEventListener("click", closeSheet));

    document.querySelectorAll("#gt-when .gt-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sheetWhen = chip.dataset.when;
        document.querySelectorAll("#gt-when .gt-chip").forEach((c) =>
          c.classList.toggle("is-active", c === chip));
        sheetDate.hidden = sheetWhen !== "pick";
      });
    });
    impBtn.addEventListener("click", () => {
      sheetImp = !sheetImp;
      impBtn.classList.toggle("is-on", sheetImp);
    });

    async function saveSheet() {
      const text = sheetInput.value.trim();
      if (!text) { sheetInput.focus(); return; }
      let date = today;
      if (sheetWhen === "tomorrow") date = tomorrow;
      if (sheetWhen === "pick") date = sheetDate.value || today;
      if (date < today) date = today;
      const { error } = await supabaseClient.from("todos")
        .insert({ student_id: profile.id, content: text, date, sort: todos.length, important: sheetImp, tag_id: sheetTag });
      if (!error) { closeSheet(); await load(); }
    }
    document.getElementById("gt-save").addEventListener("click", saveSheet);
    sheetInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing) return;   // 한글 조합 중 Enter 무시
      e.preventDefault();
      saveSheet();
    });

    /* ---------- 할 일 메모·알림 시트 (텍스트 탭) ---------- */
    function fmtRemind(t) {
      const [h, m] = String(t).split(":").map(Number);
      return (h < 12 ? dtT("오전", "AM ") : dtT("오후", "PM ")) + (h % 12 || 12) + ":" + String(m || 0).padStart(2, "0");
    }
    const tnSheet = document.getElementById("tn-sheet");
    const tnTitle = document.getElementById("tn-title");
    const tnNote = document.getElementById("tn-note");
    const tnTime = document.getElementById("tn-time");
    const tnClear = document.getElementById("tn-clear");
    const tnHint = document.getElementById("tn-hint");
    let tnId = null;
    let tnTimer = null;

    function openTodoSheet(todo) {
      tnId = todo.id;
      tnTitle.textContent = todo.content;
      tnNote.value = todo.note || "";
      tnHint.textContent = "";
      document.getElementById("tn-remind").hidden = false;
      if (todo.remind_time) {
        tnTime.value = String(todo.remind_time).slice(0, 5);
        tnClear.hidden = false;
      } else {
        /* 시간 선택은 현재 시간부터 시작 (다음 5분 단위) */
        const n = new Date(Date.now() + 5 * 60000);
        n.setMinutes(Math.ceil(n.getMinutes() / 5) * 5, 0, 0);
        tnTime.value = pad(n.getHours()) + ":" + pad(n.getMinutes());
        tnClear.hidden = true;
      }
      if (!(window.dtNotify && dtNotify.available))
        tnHint.textContent = dtT("알림은 핀로그 앱(휴대폰)에서 울려요", "Reminders ring on the Pinlog app");
      tnSheet.hidden = false;
    }
    async function tnSaveNote() {
      const todo = findTodo(tnId);
      if (!todo) return;
      const v = tnNote.value.trim();
      if (v === (todo.note || "")) return;
      todo.note = v || null;
      await supabaseClient.from("todos").update({ note: todo.note }).eq("id", tnId);
    }
    tnNote.addEventListener("input", () => {
      clearTimeout(tnTimer);
      tnTimer = setTimeout(tnSaveNote, 600);
    });
    tnTime.addEventListener("change", async () => {
      const todo = findTodo(tnId);
      if (!todo || !tnTime.value) return;
      todo.remind_time = tnTime.value;
      tnClear.hidden = false;
      await supabaseClient.from("todos").update({ remind_time: todo.remind_time }).eq("id", tnId);
      if (window.dtNotify && dtNotify.available) {
        const ok = await dtNotify.resync(profile);
        tnHint.textContent = ok
          ? dtT("알림 설정됨 — ", "Reminder set — ") + fmtRemind(todo.remind_time)
          : dtT("알림 권한을 허용해주세요 (설정 → 핀로그)", "Please allow notifications in Settings");
      } else {
        tnHint.textContent = dtT("저장됨 — 알림은 핀로그 앱(휴대폰)에서 울려요", "Saved — reminders ring on the Pinlog app");
      }
      render();
    });
    tnClear.addEventListener("click", async () => {
      const todo = findTodo(tnId);
      if (!todo) return;
      todo.remind_time = null;
      tnClear.hidden = true;
      tnHint.textContent = dtT("알림 해제됨", "Reminder off");
      await supabaseClient.from("todos").update({ remind_time: null }).eq("id", tnId);
      if (window.dtNotify && dtNotify.available) dtNotify.resync(profile, { prompt: false });
      render();
    });
    tnSheet.querySelectorAll("[data-tn-close]").forEach((el) => el.addEventListener("click", async () => {
      clearTimeout(tnTimer);
      await tnSaveNote();
      tnSheet.hidden = true;
      render();
    }));

    /* ---------- 로드 + 어제 이월 ---------- */
    const CACHE_KEY = "dtc_ghome_" + profile.id;
    async function load() {
      const stopSkel = todos.length ? () => {} : dtSkeleton(listEl, 2);
      const [{ data: cur }, { data: up }, { data: prev }, { data: tgs }] = await Promise.all([
        supabaseClient.from("todos")
          .select("*").eq("student_id", profile.id).eq("date", today)
          .order("sort").order("created_at"),
        supabaseClient.from("todos")
          .select("*").eq("student_id", profile.id).gt("date", today).eq("done", false)
          .order("date").order("created_at").limit(30),
        supabaseClient.from("todos")
          .select("*").eq("student_id", profile.id).lt("date", today).eq("done", false),
        supabaseClient.from("todo_tags")
          .select("*").eq("student_id", profile.id).order("sort").order("created_at"),
      ]);
      stopSkel();
      tags = tgs || [];
      todos = cur || [];
      upcoming = up || [];
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ todos, upcoming, tags, d: today })); } catch (e) {}
      renderAll();

      carryover = prev || [];
      const box = document.getElementById("g-carry");
      if (carryover.length) {
        document.getElementById("g-carry-text").textContent =
          dtT(`밀린 할 일 ${carryover.length}개가 있어요`, `${carryover.length} overdue task${carryover.length === 1 ? "" : "s"} waiting`);
        box.hidden = false;
      } else {
        box.hidden = true;
      }
    }

    document.getElementById("g-carry-btn").addEventListener("click", async () => {
      const ids = carryover.map((t) => t.id);
      const { error } = await supabaseClient.from("todos")
        .update({ date: today }).in("id", ids);
      if (!error) {
        document.getElementById("g-carry").hidden = true;
        await load();
      }
    });

    /* 화면 전환 깜빡임 방지 — 직전 목록 즉시 표시 후 백그라운드 갱신 */
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && c.d === today && Array.isArray(c.todos)) {
        todos = c.todos; upcoming = c.upcoming || []; tags = c.tags || [];
        renderAll();
      }
    } catch (e) {}
    await load();
    if (window.hideAppLoader) hideAppLoader();

    /* ---------- 일정 블록: 오늘 + 다가오는 7일 ---------- */
    renderHomeSchedule(document.getElementById("g-events"), document.getElementById("g-events-list"));
    (async () => {
      try {
        const s0 = new Date(); s0.setHours(0, 0, 0, 0);
        const e0 = new Date(s0.getTime() + 86400000);
        const { count } = await supabaseClient.from("events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .gte("start_at", s0.toISOString()).lt("start_at", e0.toISOString());
        const el = document.getElementById("g-sum-ev");
        if (el) el.textContent = count || 0;
      } catch (e) {}
    })();

    /* 상황 리마인더 문구 (비 예보 · 내일 이른 일정) */
    dtSmartSub(profile).then((s) => { if (s) { smartSub = s; updateSummary(); } }).catch(() => {});
  });
})();
