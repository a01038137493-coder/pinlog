/*
 * landing-demo.js — 랜딩 제품 데모 시뮬레이션 (클로드 디자인 시안의 dc 스크립트를 바닐라 JS로 포팅)
 * - 폰 데모: 4장면(체크·추가 시트·캘린더·메모) 자동 순환, 단계 버튼으로 이동
 * - 데스크톱 데모: 3장면(메모 열기·체크·새 할 일 입력) + 점 네비게이션
 * 두 데모 모두 섹션이 화면에 처음 보일 때 시작한다.
 */
(function () {
  "use strict";

  var BASE = [
    { text: "프로젝트 기획안 작성", star: true },
    { text: "병원 예약 전화", star: true },
    { text: "운동 30분" },
    { text: "장보기 (우유 · 과일)" },
    { text: "메일함 정리" },
    { text: "팀 회의 자료 정리", done: true },
    { text: "영어 공부 30분", done: true },
    { text: "책 20쪽 읽기", done: true }
  ];
  var NEW_TEXT = "저녁에 요가 20분";
  var NOTE_LINES = [
    "구성 초안",
    "- 문제 정의 → 해결 아이디어 → 일정 순서로",
    "- 지난 분기 회고 문서 참고",
    "- 금요일까지 팀에 공유하기"
  ];
  var SCENE_MS = 6500;
  var copy = function (a) { return a.map(function (b) { return Object.assign({}, b); }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ============================================================
   * 폰 데모
   * ============================================================ */
  (function phoneDemo() {
    var view = document.getElementById("sim-view");
    if (!view) return;
    var stepsEl = Array.prototype.slice.call(document.querySelectorAll("#demo-steps button"));
    var statusEl = document.getElementById("sim-status");
    var tabEl = document.getElementById("sim-tab");
    var fabEl = document.getElementById("sim-fab");
    var sheetEl = document.getElementById("sim-sheet");
    var capEl = document.getElementById("sim-cap");
    var CAPTIONS = ["오늘 할 일 — 탭하면 바로 완료", "새 할 일 — 제목 · 날짜 · 중요 표시", "캘린더 — 날짜별 일정", "메모 — 폴더 · 고정"];

    var st = { scene: 0, items: copy(BASE), tapping: -1, sheet: false, typed: "", star: false, saving: false, calDay: 28 };
    var timers = [], typer = null;
    function clearT() { timers.forEach(clearTimeout); timers = []; if (typer) { clearInterval(typer); typer = null; } }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    var TAB_SVGS = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>홈',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>캘린더',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h5M8 13h8M8 17h5"/></svg>메모',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>파일',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>설정'
    ];
    tabEl.innerHTML = TAB_SVGS.map(function (s) { return "<span>" + s + "</span>"; }).join("");
    var tabs = Array.prototype.slice.call(tabEl.children);

    function todoRow(t, i) {
      return '<div style="position:relative;display:flex;align-items:center;gap:11px;padding:10px 4px;background:#fff;border-bottom:1px solid #ededed;">' +
        (st.tapping === i ? '<span style="position:absolute;left:0;top:6px;width:31px;height:31px;border-radius:50%;background:#f04438;animation:ripple 0.55s ease-out both;pointer-events:none;"></span>' : "") +
        (t.done
          ? '<span style="flex:none;width:23px;height:23px;border-radius:50%;background:#f04438;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;">✓</span>'
          : '<span style="flex:none;width:23px;height:23px;border-radius:50%;border:1.8px solid #d6d6d6;box-sizing:border-box;"></span>') +
        (t.star ? '<span style="flex:none;color:#f04438;font-size:13.3px;">★</span>' : "") +
        '<span style="font-size:13.3px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        (t.done ? "color:#9a9a9a;text-decoration:line-through;" : "") + '">' + esc(t.text) + "</span></div>";
    }

    function homeHTML() {
      var done = st.items.filter(function (t) { return t.done; }).length;
      var total = st.items.length;
      var imp = st.items.filter(function (t) { return t.star && !t.done; }).length;
      return '<div style="position:absolute;inset:34px 0 0;overflow:hidden;animation:fadein 0.25s ease both;"><div style="padding:14px 18px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:16.8px;font-weight:800;">7월 28일 (화)</span>' +
        '<span style="display:flex;gap:10px;color:#141414;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px;"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:21px;height:21px;"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 19a7.5 7.5 0 0 1 12.4 0"/></svg></span></div>' +
        '<p style="font-size:12.6px;font-weight:600;color:#6b6b6b;margin:2px 0 14px;">지원님, 새벽까지 수고하십니다.. 무리하지 마세요!</p>' +
        '<section style="background:#fff;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.07);padding:16px 16px 4px;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:center;gap:14px;"><div style="flex:1;min-width:0;">' +
        '<p style="font-size:11.2px;font-weight:700;color:#9a9a9a;">오늘의 진행률</p>' +
        '<p style="font-size:14.3px;font-weight:800;color:#141414;">오늘 할 일 <em style="font-style:normal;color:#f04438;" id="sim-done">' + done + '개</em> 완료했어요</p>' +
        '<p style="font-size:11.9px;color:#6b6b6b;margin-top:1px;">작은 시작이 큰 변화를 만듭니다</p></div>' +
        '<div style="position:relative;width:84px;height:84px;flex:none;"><svg viewBox="0 0 84 84" style="width:100%;height:100%;display:block;">' +
        '<circle cx="42" cy="42" r="34" fill="none" stroke="#fbe7e5" stroke-width="7"/>' +
        '<circle id="sim-arc" cx="42" cy="42" r="34" fill="none" stroke="#f04438" stroke-width="7" stroke-linecap="round" stroke-dasharray="213.6" stroke-dashoffset="' + (213.6 * (1 - done / total)).toFixed(1) + '" transform="rotate(-90 42 42)" style="transition:stroke-dashoffset 0.5s cubic-bezier(0.2,0.8,0.2,1);"/></svg>' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><b id="sim-frac" style="font-size:14px;font-weight:800;color:#f04438;font-variant-numeric:tabular-nums;">' + done + "/" + total + '</b></div></div></div>' +
        '<div style="display:flex;border-top:1px solid #ededed;margin-top:12px;">' +
        '<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 0 12px;"><em style="font-style:normal;font-size:11.2px;color:#6b6b6b;font-weight:600;">남은 할 일</em><b id="sim-left" style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;">' + (total - done) + '</b></span>' +
        '<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 0 12px;border-left:1px solid #ededed;border-right:1px solid #ededed;"><em style="font-style:normal;font-size:11.2px;color:#6b6b6b;font-weight:600;">우선순위</em><b id="sim-imp" style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;">' + imp + '</b></span>' +
        '<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 0 12px;"><em style="font-style:normal;font-size:11.2px;color:#6b6b6b;font-weight:600;">오늘 일정</em><b style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;">2</b></span></div></section>' +
        '<section style="background:#fff;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.07);padding:16px 16px 10px;margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:0 2px;"><span style="font-weight:800;font-size:14.3px;">오늘 할 일</span><span id="sim-donelabel" style="color:#f04438;font-weight:800;font-size:12.3px;">' + done + "/" + total + ' 완료</span></div>' +
        '<div id="sim-todos">' + st.items.map(todoRow).join("") + "</div>" +
        '<div style="display:block;width:100%;padding:11px 4px;text-align:left;font-size:13.3px;font-weight:700;color:#9a9a9a;">＋ 할 일 추가</div></section>' +
        '<section style="background:#fff;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,0.07);padding:16px 16px 10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding:0 2px;"><span style="font-weight:800;font-size:14.3px;">예정</span></div>' +
        '<div style="display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #ededed;"><span style="flex:none;width:23px;height:23px;border-radius:50%;border:1.8px solid #d6d6d6;box-sizing:border-box;"></span><span style="flex:none;padding:3px 9px;border-radius:999px;font-size:10.1px;font-weight:700;color:#6b6b6b;background:#f4f4f5;">내일</span><span style="flex:none;color:#f04438;font-size:13.3px;">★</span><span style="font-size:13.3px;font-weight:600;">주간 보고서 제출</span></div>' +
        '<div style="display:flex;align-items:center;gap:11px;padding:10px 4px;"><span style="flex:none;width:23px;height:23px;border-radius:50%;border:1.8px solid #d6d6d6;box-sizing:border-box;"></span><span style="flex:none;padding:3px 9px;border-radius:999px;font-size:10.1px;font-weight:700;color:#6b6b6b;background:#f4f4f5;">7/31 (금)</span><span style="font-size:13.3px;font-weight:600;">치과 예약 확인</span></div></section>' +
        "</div></div>";
    }

    function calHTML() {
      var events = {
        28: [{ time: "오후 2:00", title: "팀 미팅" }, { time: "오후 7:30", title: "필라테스" }],
        29: [{ time: "오전 11:00", title: "치과 예약" }],
        31: [{ time: "오후 6:30", title: "프로젝트 마감 회의" }, { time: "오후 8:00", title: "캠핑 짐 챙기기" }]
      };
      var dots = [24, 26, 27, 28, 29, 31];
      var dows = ["월", "화", "수", "목", "금", "토", "일"];
      var cells = "";
      dows.forEach(function (d, i) {
        cells += '<span style="font-size:10.5px;font-weight:700;color:' + (i === 5 ? "#3672e0" : i === 6 ? "#f04438" : "#9a9a9a") + ';padding:4px 0;">' + d + "</span>";
      });
      for (var k = 0; k < 2; k++) cells += "<span></span>";
      for (var n = 1; n <= 31; n++) {
        var sel = n === st.calDay;
        cells += '<span style="position:relative;height:44px;display:flex;align-items:center;justify-content:center;font-size:12.6px;line-height:1;font-variant-numeric:tabular-nums;">' +
          (sel
            ? '<i style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:34px;height:44px;border-radius:12px;background:#ececea;"></i>' +
              '<i style="position:absolute;left:50%;top:5px;transform:translateX(-50%);width:26px;height:26px;border-radius:50%;background:#141414;"></i>' +
              '<b style="position:absolute;left:0;right:0;top:10px;color:#fff;font-weight:800;">' + n + "</b>"
            : '<span style="position:absolute;left:0;right:0;top:10px;color:#141414;">' + n + "</span>") +
          (dots.indexOf(n) >= 0 ? '<i style="position:absolute;top:28px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#f04438;"></i>' : "") +
          "</span>";
      }
      var evs = (events[st.calDay] || []).map(function (e) {
        return '<div style="background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:14px 15px;display:flex;gap:12px;align-items:center;margin-bottom:8px;animation:popin 0.28s ease both;">' +
          '<b style="flex:none;color:#f04438;font-size:12.3px;font-weight:800;">' + e.time + '</b><span style="font-size:13.3px;font-weight:600;flex:1;">' + esc(e.title) + '</span><span style="color:#c9c9c6;font-size:13px;">›</span></div>';
      }).join("");
      return '<div style="position:absolute;inset:34px 0 0;overflow:hidden;animation:fadein 0.25s ease both;"><div style="padding:8px 18px 0;">' +
        '<p style="text-align:center;font-size:16.8px;font-weight:800;margin-bottom:12px;">2026년 7월</p>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">' + cells + "</div>" +
        '<div style="background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:12px 16px;margin-top:12px;font-size:12.3px;font-weight:600;color:#6b6b6b;">7월 전체 일정 <b style="color:#f04438;font-weight:800;">7개</b> · 오늘 <b style="color:#f04438;font-weight:800;">2개</b></div>' +
        '<p style="font-size:12.3px;font-weight:800;color:#6b6b6b;margin:16px 2px 8px;">7월 ' + st.calDay + "일</p>" + evs +
        '<p style="font-size:12.3px;font-weight:800;color:#6b6b6b;margin:18px 2px 0;border-top:1px solid #e6e6e4;padding-top:16px;">다가오는 일정</p>' +
        "</div></div>";
    }

    function memoHTML() {
      var card = function (title, sub, delay, pin) {
        return '<div style="background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:14px 16px;margin-bottom:10px;animation:popin 0.3s ease both ' + delay + 's;">' +
          '<b style="font-size:13.6px;font-weight:800;">' + (pin ? "📌 " : "") + title + "</b>" +
          '<p style="font-size:11.9px;color:#9a9a9a;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + sub + "</p></div>";
      };
      return '<div style="position:absolute;inset:0;overflow:hidden;background:#f4f4f5;animation:fadein 0.25s ease both;">' +
        '<div style="padding:40px 20px 14px;background:#111;color:#fff;"><b style="font-size:15px;font-weight:700;letter-spacing:-0.02em;">메모</b></div>' +
        '<div style="padding:14px 18px 0;">' +
        '<div style="background:#fff;border:1px solid #ededed;border-radius:14px;padding:12px 15px;font-size:13.3px;color:#9a9a9a;">메모 검색</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<span style="background:#111;color:#fff;border-radius:999px;padding:7px 14px;font-size:12.3px;font-weight:800;">전체 4</span>' +
        '<span style="background:#fff;border:1px solid #ededed;color:#141414;border-radius:999px;padding:7px 14px;font-size:12.3px;font-weight:700;">업무 2</span>' +
        '<span style="background:#fff;border:1px solid #ededed;color:#141414;border-radius:999px;padding:7px 14px;font-size:12.3px;font-weight:700;">일상 2</span>' +
        '<span style="border:1px dashed #d6d6d6;color:#9a9a9a;border-radius:999px;padding:7px 14px;font-size:12.3px;font-weight:700;">폴더 관리</span></div>' +
        '<p style="font-size:12.3px;font-weight:800;color:#6b6b6b;margin:18px 2px 8px;">고정된 메모</p>' +
        card("주간 회의 정리", "오늘 오전 1:50 &nbsp; - 신규 기능 일정 확정 - 디자인 시안은 금요일까지 공유", 0.05, true) +
        '<p style="font-size:12.3px;font-weight:800;color:#6b6b6b;margin:18px 2px 8px;">메모</p>' +
        card("프로젝트 아이디어", "7월 27일 &nbsp; - 온보딩 화면 단순화 - 위젯에서 바로 체크 기능 - 주간 리포트", 0.14) +
        card("장보기 목록", "7월 26일 &nbsp; - 우유 - 달걀 - 과일 (사과, 바나나) - 원두", 0.23) +
        card("여행 준비물", "7월 24일 &nbsp; - 보조배터리 - 선크림 - 편한 운동화 - 카메라 충전", 0.32) +
        "</div></div>";
    }

    function sheetHTML() {
      return '<div style="position:absolute;inset:0;z-index:30;">' +
        '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35);animation:fadein 0.25s ease both;"></div>' +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -16px 40px rgba(0,0,0,0.16);padding:14px 18px 26px;animation:sheetup 0.32s cubic-bezier(0.2,0.8,0.2,1) both;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
        '<span style="font-size:13.3px;font-weight:600;color:#6b6b6b;">취소</span><span style="font-size:14.3px;font-weight:800;">새 할 일</span>' +
        '<span id="sim-save" style="font-size:13.3px;font-weight:800;color:#f04438;">추가</span></div>' +
        '<div style="width:100%;padding:14px 15px;font-size:14.7px;border:1.5px solid #141414;border-radius:12px;background:#fff;box-shadow:0 0 0 3px rgba(0,0,0,0.14);margin-bottom:12px;min-height:50px;">' +
        '<span id="sim-typed"></span><i style="display:inline-block;width:1.5px;height:16px;background:#141414;vertical-align:-3px;animation:caret 1s steps(1) infinite;"></i></div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
        '<span style="background:#111;border:1px solid #111;color:#fff;border-radius:999px;padding:8px 14px;font-size:12.3px;font-weight:700;">오늘</span>' +
        '<span style="background:#fff;border:1px solid #ededed;color:#6b6b6b;border-radius:999px;padding:8px 14px;font-size:12.3px;font-weight:700;">내일</span>' +
        '<span style="background:#fff;border:1px solid #ededed;color:#6b6b6b;border-radius:999px;padding:8px 14px;font-size:12.3px;font-weight:700;">날짜 선택</span></div>' +
        '<span id="sim-star" style="display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;font-size:12.3px;font-weight:700;color:#6b6b6b;background:#fff;border:1px solid #ededed;"><span style="color:#d6d6d6;">★</span> 중요한 할 일</span>' +
        "</div></div>";
    }

    function paintChrome() {
      statusEl.classList.toggle("is-inv", st.scene === 3);
      tabs.forEach(function (t, i) {
        t.classList.toggle("is-on", (i === 0 && st.scene <= 1) || (i === 1 && st.scene === 2) || (i === 2 && st.scene === 3));
      });
      fabEl.style.display = st.sheet ? "none" : "";
      capEl.textContent = CAPTIONS[st.scene];
      stepsEl.forEach(function (b, i) { b.classList.toggle("is-on", i === st.scene); });
    }

    function paintScene() {
      view.innerHTML = st.scene === 2 ? calHTML() : st.scene === 3 ? memoHTML() : homeHTML();
      sheetEl.innerHTML = st.sheet ? sheetHTML() : "";
      paintChrome();
    }

    /* 체크 시 진행률만 부분 갱신 (링은 트랜지션 유지) */
    function paintCounts() {
      var done = st.items.filter(function (t) { return t.done; }).length;
      var total = st.items.length;
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set("sim-done", done + "개");
      set("sim-frac", done + "/" + total);
      set("sim-left", total - done);
      set("sim-imp", st.items.filter(function (t) { return t.star && !t.done; }).length);
      set("sim-donelabel", done + "/" + total + " 완료");
      var arc = document.getElementById("sim-arc");
      if (arc) arc.style.strokeDashoffset = (213.6 * (1 - done / total)).toFixed(1);
      var box = document.getElementById("sim-todos");
      if (box) box.innerHTML = st.items.map(todoRow).join("");
    }

    function tap(i) {
      st.tapping = i;
      paintCounts();
      at(90, function () { st.items[i].done = !st.items[i].done; paintCounts(); });
      at(650, function () { st.tapping = -1; paintCounts(); });
    }

    function run(i) {
      clearT();
      st.scene = i; st.sheet = false; st.typed = ""; st.star = false; st.saving = false; st.tapping = -1;
      if (i === 0) {
        st.items = copy(BASE);
        paintScene();
        at(1100, function () { tap(0); });
        at(2700, function () { tap(1); });
        at(4300, function () { tap(2); });
      } else if (i === 1) {
        st.items = copy(BASE);
        paintScene();
        at(500, function () { st.sheet = true; sheetEl.innerHTML = sheetHTML(); paintChrome(); });
        at(1100, function () {
          var n = 0;
          typer = setInterval(function () {
            n += 1;
            var el = document.getElementById("sim-typed");
            if (el) el.textContent = NEW_TEXT.slice(0, n);
            if (n >= NEW_TEXT.length) { clearInterval(typer); typer = null; }
          }, 85);
        });
        at(2700, function () {
          var s = document.getElementById("sim-star");
          if (s) { s.style.cssText = "display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;font-size:12.3px;font-weight:800;color:#fff;background:#f04438;"; s.innerHTML = "<span>★</span> 중요한 할 일"; }
        });
        at(3400, function () {
          var b = document.getElementById("sim-save");
          if (b) b.style.cssText = "font-size:13.3px;font-weight:800;color:#fff;background:#f04438;border-radius:8px;padding:4px 12px;";
        });
        at(3850, function () {
          st.sheet = false;
          st.items = st.items.concat([{ text: NEW_TEXT, star: true }]);
          sheetEl.innerHTML = "";
          paintChrome();
          paintCounts();
        });
      } else if (i === 2) {
        st.calDay = 28;
        paintScene();
        at(1900, function () { st.calDay = 29; paintScene(); });
        at(4100, function () { st.calDay = 31; paintScene(); });
      } else {
        paintScene();
      }
      at(SCENE_MS, function () { run((i + 1) % 4); });
    }

    stepsEl.forEach(function (b, i) { b.addEventListener("click", function () { run(i); }); });

    var started = false;
    function start() { if (!started) { started = true; run(0); } }
    var sec = document.getElementById("demo");
    if ("IntersectionObserver" in window && sec) {
      new IntersectionObserver(function (es, io) {
        es.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
      }, { threshold: 0.15 }).observe(sec);
    } else start();
  })();

  /* ============================================================
   * 데스크톱 데모
   * ============================================================ */
  (function deskDemo() {
    var todosEl = document.getElementById("dsk-todos");
    if (!todosEl) return;
    var navEl = document.getElementById("dsk-nav");
    var menuEl = document.getElementById("dsk-menu");
    var noteEl = document.getElementById("dsk-note");
    var addEl = document.getElementById("dsk-add");
    var capEl = document.getElementById("dsk-cap");
    var dots = Array.prototype.slice.call(document.querySelectorAll("#dsk-dots button"));
    var CAPTIONS = ["할 일을 고르면 오른쪽에 메모가 열려요", "체크하면 진행률이 바로 올라가요", "＋ 새로 만들기 — 할 일 · 일정 · 메모 · 파일"];

    var NAV = [
      ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>', "홈"],
      ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>', "캘린더"],
      ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h5M8 13h8M8 17h5"/></svg>', "메모"],
      ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>', "파일"],
      ['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>', "설정"]
    ];
    navEl.innerHTML = NAV.map(function (n, i) {
      return '<span class="dsknav__item' + (i === 0 ? " is-on" : "") + '">' + n[0] + "<span>" + n[1] + "</span></span>";
    }).join("");

    var st = { scene: 0, items: copy(BASE), sel: -1, lines: 0, typing: false, typed: "" };
    var timers = [], typer = null;
    function clearT() { timers.forEach(clearTimeout); timers = []; if (typer) { clearInterval(typer); typer = null; } }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function paintTodos() {
      var rows = "";
      if (st.typing) {
        rows += '<div class="dskrow"><span class="dskchk"></span><span class="dskrow__txt" id="dsk-typed">' + esc(st.typed) + '</span><i class="dskcaret"></i></div>';
      }
      rows += st.items.slice(0, 5).map(function (t, i) {
        return '<div class="dskrow">' +
          (st.sel === i ? '<i class="dskrow__sel"></i>' : "") +
          '<span class="dskchk' + (t.done ? " is-done" : "") + '">' + (t.done ? "✓" : "") + "</span>" +
          (t.star ? '<span class="dskstar">★</span>' : "") +
          '<span class="dskrow__txt' + (t.done ? " is-done" : "") + '">' + esc(t.text) + "</span></div>";
      }).join("");
      todosEl.innerHTML = rows;
      addEl.style.display = st.typing ? "none" : "";

      var done = st.items.filter(function (t) { return t.done; }).length;
      var total = st.items.length;
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set("dsk-done", done + "개");
      set("dsk-frac", done + "/" + total);
      set("dsk-left", total - done);
      set("dsk-imp", st.items.filter(function (t) { return t.star && !t.done; }).length);
      set("dsk-donelabel", done + "/" + total + " 완료");
      var arc = document.getElementById("dsk-arc");
      if (arc) arc.style.strokeDashoffset = (213.6 * (1 - done / total)).toFixed(1);
    }

    function paintNote() {
      if (st.lines > 0) {
        noteEl.innerHTML = "<b>프로젝트 기획안 작성</b>" +
          NOTE_LINES.slice(0, st.lines).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
      } else {
        noteEl.innerHTML = '<p class="dsknote__empty">왼쪽에서 할 일을 선택하면 여기에 메모를 쓸 수 있어요.</p>';
      }
    }

    function paintChrome() {
      menuEl.hidden = !st.menu;
      capEl.textContent = CAPTIONS[st.scene];
      dots.forEach(function (d, i) { d.classList.toggle("is-on", i === st.scene); });
    }

    function paintAll() { paintTodos(); paintNote(); paintChrome(); }

    function dtap(i) {
      st.sel = i;
      st.items = st.items.map(function (it, k) { return k === i ? Object.assign({}, it, { done: true }) : it; });
      paintTodos();
    }

    function run(i) {
      clearT();
      st.scene = i; st.menu = false; st.typing = false; st.typed = "";
      if (i === 0) {
        st.items = copy(BASE); st.sel = -1; st.lines = 0;
        paintAll();
        at(700, function () { st.sel = 0; paintTodos(); });
        [1500, 2300, 3100, 3900].forEach(function (ms, k) {
          at(ms, function () { st.lines = k + 1; paintNote(); });
        });
      } else if (i === 1) {
        st.items = copy(BASE); st.sel = 0; st.lines = 4;
        paintAll();
        at(1000, function () { dtap(0); });
        at(2600, function () { dtap(1); });
        at(4200, function () { dtap(2); });
      } else {
        st.items = copy(BASE); st.sel = -1; st.lines = 4;
        paintAll();
        at(600, function () { st.menu = true; paintChrome(); });
        at(1800, function () { st.menu = false; st.typing = true; paintChrome(); paintTodos(); });
        at(2100, function () {
          var n = 0;
          typer = setInterval(function () {
            n += 1;
            st.typed = NEW_TEXT.slice(0, n);
            var el = document.getElementById("dsk-typed");
            if (el) el.textContent = st.typed;
            if (n >= NEW_TEXT.length) { clearInterval(typer); typer = null; }
          }, 85);
        });
        at(4200, function () {
          st.typing = false; st.typed = ""; st.sel = 0;
          st.items = [{ text: NEW_TEXT, star: true }].concat(st.items);
          paintTodos();
        });
      }
      at(SCENE_MS + 1200, function () { run((i + 1) % 3); });
    }

    dots.forEach(function (d, i) { d.addEventListener("click", function () { run(i); }); });

    /* 좁은 화면: 1000px 창을 통째로 축소 */
    var scaleBox = document.getElementById("dsk-scale");
    function rescale() {
      var w = scaleBox.parentElement.clientWidth;
      var s = Math.min(1, w / 1000);
      var win = scaleBox.firstElementChild;
      if (s < 1) {
        win.style.width = "1000px";
        win.style.transform = "scale(" + s + ")";
        win.style.transformOrigin = "top left";
        scaleBox.style.height = (702 * s) + "px";
      } else {
        win.style.width = ""; win.style.transform = ""; scaleBox.style.height = "";
      }
    }
    window.addEventListener("resize", rescale);
    rescale();

    var started = false;
    function start() { if (!started) { started = true; run(0); } }
    var sec = document.querySelector(".deskapp");
    if ("IntersectionObserver" in window && sec) {
      new IntersectionObserver(function (es, io) {
        es.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
      }, { threshold: 0.15 }).observe(sec);
    } else start();
  })();
})();
