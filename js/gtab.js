/*
 * gtab.js — 일반 사용자 태블릿/PC 홈 (심플 투두 플래너)
 * ------------------------------------------------------------
 * general.html 전용. 모바일 홈(ghome.js)·수험생 홈(student.js)과 완전히 분리.
 * - 왼쪽: 오늘 할 일(todos) — ＋ 작성 시트(날짜·중요), 탭=완료, 스와이프=중요·삭제
 *         중요 항목 상단, 완료 항목 하단 정렬. 오늘 이후 날짜는 "예정" 카드로.
 * - 오른쪽: 일정 블록(오늘 + 다가오는 7일, Apple 캘린더)
 * - 상시 디스플레이: 큰 시계, 자정 리로드, 5분 주기 데이터 갱신
 * ------------------------------------------------------------ */
(function () {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
  const DEL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>`;

  document.addEventListener("DOMContentLoaded", async () => {
    /* ---------- 상시 시계 (인증을 기다리지 않고 즉시 시작) ---------- */
    const clockEl = document.getElementById("g-clock");
    function tickClock() {
      clockEl.textContent = fmtTime12(new Date());
      document.getElementById("g-date").textContent = formatKoreanDate();
    }
    tickClock();
    setInterval(tickClock, 5000);

    const profile = await requireRole(["student"]);
    if (!profile) return;
    if (!profile.onboarded) { window.location.replace("/onboarding.html"); return; }
    // 수험생이 잘못 들어오면 수험생 태블릿 홈으로
    if (profile.user_type !== "general") { window.location.replace("/student.html"); return; }

    /* 날짜 아래 시간대별 인사말 */
    try {
      const gEl = document.getElementById("g-greet");
      if (gEl) { gEl.textContent = dtGreeting(profile.name); gEl.hidden = false; }
    } catch (e) {}

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
      if (dateStr === tomorrow) return "내일";
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return `${m}/${d} (${["일", "월", "화", "수", "목", "금", "토"][dt.getDay()]})`;
    };

    /* ---------- 렌더 ---------- */
    const rowHtml = (t, dateLbl) => `
      <div class="gtodo__row memo-row${t.id === noteId ? " is-note" : ""}" data-id="${t.id}">
        <div class="memo-row__actions">
          <button type="button" class="memo-act memo-act--imp" data-act="imp">${STAR_SVG}<span>중요</span></button>
          <button type="button" class="memo-act memo-act--del" data-act="del">${DEL_SVG}<span>삭제</span></button>
        </div>
        <button type="button" class="gtodo__item${t.done ? " is-done" : ""}">
          <span class="gtodo__check">${t.done ? "✓" : ""}</span>
          ${dateLbl ? `<span class="gup-date">${dateLbl}</span>` : ""}
          ${t.important ? `<span class="gtodo__star">★</span>` : ""}
          <span class="gtodo__text">${esc(t.content)}</span>
          ${tagHtml(t)}
        </button>
        <span class="gt-webacts">
          <button type="button" data-wact="imp" title="중요"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2-5.6 3.2 1.3-6.2L3 9.5l6.3-.7z"/></svg></button>
          <button type="button" data-wact="edit" title="이름 수정"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button type="button" data-wact="del" title="삭제"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg></button>
        </span>
      </div>`;

    function render() {
      const done = todos.filter((t) => t.done).length;
      countEl.hidden = todos.length === 0;
      countEl.textContent = `${done}/${todos.length} 완료`;

      if (!todos.length) {
        listEl.innerHTML = `<p class="gtodo__empty">오늘 할 일을 적어보세요</p>`;
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
      box.querySelector(".msum__label").textContent = empty ? "오늘의 시작" : "오늘의 진행률";
      const titleEl = box.querySelector(".msum__title");
      if (empty) {
        titleEl.textContent = "오늘 할 일을 추가해볼까요?";
        document.getElementById("g-sum-sub").textContent =
          smartSub || "작게 시작할수록 꾸준해져요";
      } else {
        const C = 188.5;
        const pct = done / n;
        titleEl.innerHTML = "오늘 할 일 <em>" + done + "개</em> 완료했어요";
        document.getElementById("g-sum-frac").textContent = done + "/" + n;
        document.getElementById("g-sum-left").textContent = n - done;
        document.getElementById("g-sum-imp").textContent = todos.filter((t) => t.important && !t.done).length;
        document.getElementById("g-sum-arc").style.strokeDashoffset = (C * (1 - pct)).toFixed(1);
        document.getElementById("g-sum-sub").textContent =
          pct >= 1 ? "오늘 할 일을 전부 끝냈어요! 🎉"
          : smartSub ? smartSub
          : pct >= 0.5 ? "절반 넘게 왔어요, 이 흐름 그대로!"
          : "작은 시작이 큰 변화를 만듭니다";
      }
      box.hidden = false;
    }

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
        if (!active || WEB_DESK()) return;      // 웹은 스와이프 대신 호버 액션 사용
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
        if (e.target.closest && (e.target.closest(".gt-webacts") || e.target.closest(".gt-editin"))) return;
        if (row.classList.contains("is-open")) { closeOpen(); return; }
        const todo = findTodo(row.dataset.id);
        if (!todo) return;
        if (WEB_DESK() && !(e.target.closest && e.target.closest(".gtodo__check"))) {
          openNote(todo);                   // 웹: 업무 클릭 = 오른쪽 메모 패널
          return;
        }
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

      /* 웹 호버 액션: 중요 · 이름 수정 · 삭제 */
      const wImp = row.querySelector("[data-wact=imp]");
      if (wImp) wImp.addEventListener("click", async () => {
        const todo = findTodo(row.dataset.id);
        if (!todo) return;
        todo.important = !todo.important;
        renderAll();
        const { error } = await supabaseClient.from("todos")
          .update({ important: todo.important }).eq("id", todo.id);
        if (error) { todo.important = !todo.important; renderAll(); }
      });
      const wDel = row.querySelector("[data-wact=del]");
      if (wDel) wDel.addEventListener("click", async () => {
        if (!confirm("이 할 일을 삭제할까요?")) return;
        const id = row.dataset.id;
        const { error } = await supabaseClient.from("todos").delete().eq("id", id);
        if (!error) {
          todos = todos.filter((t) => t.id !== id);
          upcoming = upcoming.filter((t) => t.id !== id);
          renderAll();
        }
      });
      const wEdit = row.querySelector("[data-wact=edit]");
      if (wEdit) wEdit.addEventListener("click", () => {
        const todo = findTodo(row.dataset.id);
        if (!todo) return;
        const span = row.querySelector(".gtodo__text");
        const input = document.createElement("input");
        input.type = "text";
        input.className = "gt-editin";
        input.maxLength = 200;
        input.value = todo.content;
        span.replaceWith(input);
        input.focus();
        input.select();
        const commit = async () => {
          const v = input.value.trim();
          if (v && v !== todo.content) {
            todo.content = v;
            await supabaseClient.from("todos").update({ content: v }).eq("id", todo.id);
            if (noteId === todo.id) document.getElementById("gnote-title").textContent = v;
          }
          renderAll();
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); input.blur(); }
          if (e.key === "Escape") { input.value = todo.content; input.blur(); }
        });
        input.addEventListener("blur", commit);
      });
    }


    /* ---------- 홈 커스터마이징 (웹) — 수험생 홈식: 흔들림·삭제·카탈로그·드래그 순서 ---------- */
    const HOME_CFG_KEY = "dt_home_cfg2";
    const GW_DEFS = {
      todos: { label: "오늘 할 일", fixed: true },
      upcoming: { label: "예정 할 일", el: () => document.getElementById("g-upcoming") },
      events: { label: "일정", el: () => document.getElementById("g-events") },
      note: { label: "업무 메모", el: () => document.getElementById("gnote") },
    };
    function homeCfg() {
      try {
        const c = JSON.parse(localStorage.getItem(HOME_CFG_KEY)) || {};
        c.order = Array.isArray(c.order) ? c.order : ["upcoming", "events"];
        c.hidden = c.hidden || {};
        return c;
      } catch (e) { return { order: ["upcoming", "events"], hidden: {} }; }
    }
    function saveHomeCfg(c) { localStorage.setItem(HOME_CFG_KEY, JSON.stringify(c)); }
    let homeEditing = false;

    function applyHomeCfg() {
      const c = homeCfg();
      ["upcoming", "events", "note"].forEach((k) => {
        const el = GW_DEFS[k].el();
        if (el) el.classList.toggle("cfg-hidden", c.hidden[k] === true);
      });
      // 왼쪽 열 순서: 할 일(0) → 이월(1) → order 배열(2~)
      c.order.forEach((k, i) => {
        const el = GW_DEFS[k] && GW_DEFS[k].el && GW_DEFS[k].el();
        if (el) el.style.order = String(2 + i);
      });
    }

    function renderGwCatalog() {
      const box = document.getElementById("gw-catalog-list");
      const c = homeCfg();
      const hidden = ["upcoming", "events", "note"].filter((k) => c.hidden[k] === true);
      box.innerHTML = hidden.length
        ? hidden.map((k) => `<button type="button" class="mopt" data-gw-add="${k}">${GW_DEFS[k].label}<span class="mopt__sub">추가</span></button>`).join("")
        : '<p class="settings-menu__hint" style="padding:12px 4px;">숨긴 위젯이 없어요. 편집 모드에서 − 를 눌러 위젯을 숨길 수 있어요.</p>';
      box.querySelectorAll("[data-gw-add]").forEach((b) =>
        b.addEventListener("click", () => {
          const c2 = homeCfg();
          c2.hidden[b.dataset.gwAdd] = false;
          saveHomeCfg(c2);
          applyHomeCfg();
          renderGwCatalog();
        }));
    }

    (function wireHomeEdit() {
      const btn = document.getElementById("home-edit-btn");
      if (!btn) return;
      const grid = document.querySelector(".gtab-grid");
      const catalog = document.getElementById("gw-catalog");

      function setEdit(on) {
        homeEditing = on;
        document.body.classList.toggle("home-edit", on);
        btn.textContent = on ? "완료" : "홈 편집";
        btn.classList.toggle("is-on", on);
        // 삭제 배지 부착/제거
        ["upcoming", "events", "note"].forEach((k) => {
          const el = GW_DEFS[k].el();
          if (!el) return;
          let del = el.querySelector(".gw-del");
          if (on && !del) {
            del = document.createElement("button");
            del.type = "button";
            del.className = "gw-del";
            del.textContent = "−";
            del.addEventListener("click", (e) => {
              e.stopPropagation();
              const c = homeCfg();
              c.hidden[k] = true;
              saveHomeCfg(c);
              applyHomeCfg();
            });
            el.appendChild(del);
          } else if (!on && del) del.remove();
        });
        // 위젯 추가 타일
        let addTile = document.getElementById("gw-addtile");
        if (on && !addTile) {
          addTile = document.createElement("button");
          addTile.type = "button";
          addTile.id = "gw-addtile";
          addTile.className = "gw-addtile";
          addTile.textContent = "＋ 위젯 추가";
          addTile.style.order = "99";
          addTile.addEventListener("click", () => { renderGwCatalog(); catalog.hidden = false; });
          const col = document.querySelector(".gtab-col");
          if (col) col.appendChild(addTile);
        } else if (!on && addTile) addTile.remove();
      }
      btn.addEventListener("click", () => setEdit(!homeEditing));
      catalog.querySelectorAll("[data-gw-close]").forEach((el) =>
        el.addEventListener("click", () => { catalog.hidden = true; }));

      // 편집 모드: 드래그로 순서 교체 (예정 ↔ 일정)
      let dragKey = null;
      ["upcoming", "events"].forEach((k) => {
        const el = GW_DEFS[k].el();
        if (!el) return;
        el.addEventListener("pointerdown", () => { if (homeEditing) dragKey = k; });
        el.addEventListener("pointerup", () => { dragKey = null; });
        el.addEventListener("pointerenter", () => {
          if (!homeEditing || !dragKey || dragKey === k) return;
          const c = homeCfg();
          const a = c.order.indexOf(dragKey), b = c.order.indexOf(k);
          if (a < 0 || b < 0) return;
          c.order[a] = k; c.order[b] = dragKey;
          saveHomeCfg(c);
          applyHomeCfg();
        });
      });
      applyHomeCfg();
    })();

    /* ---------- 일정 상세 패널 (오른쪽 스티키) ---------- */
    function showEventDetail(ev) {
      const box = document.getElementById("gevd");
      if (!box || !ev) return;
      const s = new Date(ev.startDate);
      const e2 = new Date(ev.endDate || ev.startDate);
      const dows = ["일", "월", "화", "수", "목", "금", "토"];
      document.getElementById("gevd-date").textContent =
        `${s.getMonth() + 1}월 ${s.getDate()}일 (${dows[s.getDay()]})`;
      const time = ev.isAllDay ? "하루 종일" : `${fmtTime12(s)} – ${fmtTime12(e2)}`;
      const REP = { daily: "매일", weekly: "매주", monthly: "매월", yearly: "매년" };
      const alertTxt = ev.alertMin == null ? null
        : ev.alertMin === 0 ? "일정 시작 시간"
        : `${Math.abs(ev.alertMin) >= 1440 ? Math.abs(ev.alertMin) / 1440 + "일"
          : Math.abs(ev.alertMin) >= 60 ? Math.abs(ev.alertMin) / 60 + "시간"
          : Math.abs(ev.alertMin) + "분"} 전`;
      let html = `<p class="gevd__title">${esc(ev.title || "(제목 없음)")}</p>
        <div class="gevd__row"><span>시간</span><b>${time}</b></div>`;
      if (ev.repeat) html += `<div class="gevd__row"><span>반복</span><b>${REP[ev.repeat] || ev.repeat}</b></div>`;
      if (alertTxt) html += `<div class="gevd__row"><span>알림</span><b>${alertTxt}</b></div>`;
      const pad2 = (n) => String(n).padStart(2, "0");
      html += `<a class="mtoday__more" href="/calendar.html?date=${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}">캘린더에서 열기</a>`;
      document.getElementById("gevd-body").innerHTML = html;
      box.hidden = false;
      const nb = document.getElementById("gnote");
      if (nb) nb.hidden = true;
    }
    document.getElementById("g-events-list").addEventListener("click", (e) => {
      const row = e.target.closest ? e.target.closest("[data-hev]") : null;
      if (!row) return;
      const ev = (window.__dtHomeEvents || [])[Number(row.dataset.hev)];
      if (ev) showEventDetail(ev);
    });

    /* ---------- 웹 데스크톱: 업무 메모 패널 ---------- */
    const WEB_DESK = () => (document.documentElement.classList.contains("dt-web") ||
      document.documentElement.classList.contains("dt-app")) &&
      window.matchMedia("(min-width: 1100px)").matches;
    const noteBox = document.getElementById("gnote");
    const noteBody = document.getElementById("gnote-body");
    const noteStatus = document.getElementById("gnote-status");
    let noteId = null;
    let noteTimer = null;

    function openNote(t, focus) {
      if (!t || !noteBox) return;
      if (homeCfg().hidden.note === true) return;
      noteId = t.id;
      document.getElementById("gnote-title").textContent = t.content;
      noteBody.value = t.note || "";
      noteStatus.textContent = "";
      noteStatus.hidden = true;
      noteBox.hidden = false;
      const evd = document.getElementById("gevd");
      if (evd) evd.hidden = true;
      document.querySelectorAll(".gtodo__row").forEach((r) =>
        r.classList.toggle("is-note", r.dataset.id === noteId));
      if (focus !== false) noteBody.focus();
    }

    async function saveNote() {
      if (!noteId) return;
      const t = findTodo(noteId);
      const val = noteBody.value;
      if (t && (t.note || "") === val) return;
      noteStatus.hidden = false;
      noteStatus.textContent = "저장 중…";
      const { error } = await supabaseClient.from("todos").update({ note: val }).eq("id", noteId);
      if (error) { noteStatus.textContent = "저장 실패"; return; }
      if (t) t.note = val;
      noteStatus.textContent = "저장됨";
      setTimeout(() => { if (noteStatus.textContent === "저장됨") noteStatus.hidden = true; }, 1400);
    }
    if (noteBody) {
      noteBody.addEventListener("input", () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 700); });
      window.addEventListener("pagehide", saveNote);
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
    if (new URLSearchParams(location.search).get("newtodo")) setTimeout(openSheet, 250);
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

    /* ---------- 로드 + 어제 이월 ---------- */
    async function load() {
      const stopSkel = dtSkeleton(listEl, 2);
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
      renderAll();

      carryover = prev || [];
      const box = document.getElementById("g-carry");
      if (carryover.length) {
        document.getElementById("g-carry-text").textContent =
          `밀린 할 일 ${carryover.length}개가 있어요`;
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

    await load();
    if (window.hideAppLoader) hideAppLoader();

    /* 우측 스티키 패널 상시 표시 — 첫 할 일 메모(미완료 우선) 또는 빈 안내 */
    if ((document.documentElement.classList.contains("dt-web") ||
         document.documentElement.classList.contains("dt-app")) &&
        window.matchMedia("(min-width: 900px)").matches &&
        homeCfg().hidden.note !== true) {
      document.body.classList.add("has-notepanel");   // 오른쪽 열을 메모 패널이 차지 → 일정은 왼쪽
      const firstTodo = [...todos].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))[0];
      if (firstTodo) {
        openNote(firstTodo, false);
      } else {
        document.getElementById("gnote-title").textContent = "업무 메모";
        noteBody.value = "";
        noteBody.placeholder = "할 일을 클릭하면 해당 업무의 메모를 쓸 수 있어요";
        noteBox.hidden = false;
      }
    }

    /* ---------- 일정 블록: 오늘 + 다가오는 7일 (없으면 안내 문구 유지) ---------- */
    const renderEvents = () => renderHomeSchedule(
      document.getElementById("g-events"), document.getElementById("g-events-list"));
    renderEvents();

    /* 요약 블록: 오늘 일정 개수 */
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

    /* ---------- 상시 디스플레이: 자동 새로고침 ----------
     * 켜놓는 화면이라 데이터가 오래 묵는다.
     * - 날짜가 바뀌면(자정) 전체 리로드
     * - 5분마다 + 화면에 다시 보일 때 할일·일정 갱신 */
    async function refreshAll() {
      if (getTodayString() !== today) { window.location.reload(); return; }
      await load();
      renderEvents();
    }
    setInterval(refreshAll, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshAll();
    });
  });
})();
