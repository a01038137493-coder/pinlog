/*
 * notify.js
 * ------------------------------------------------------------
 * 앱 로컬 알림 (기기별 설정 — localStorage "dt_notify")
 * - 아침 플랜 리마인더 / 저녁 기록 리마인더 (매일 반복)
 * - 타임박스 블록 시작 알림 (수험생, 요일 반복)
 * 설정 변경·타임박스 수정·앱 실행 시 resync 로 전체 재예약한다.
 * 웹(브라우저)에서는 dtNotify.available = false 로 동작하지 않음.
 * ------------------------------------------------------------
 */

(function () {
  const KEY = "dt_notify";
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const LN = isNative && window.Capacitor.Plugins ? window.Capacitor.Plugins.LocalNotifications : null;

  const DEF = {
    morning: false, morningTime: "08:00",
    evening: false, eveningTime: "22:00",
    wake: false, wakeTime: "07:30",
    sleep: false, sleepTime: "23:30",
    timebox: false,
  };

  function getSettings() {
    try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
    catch (e) { return { ...DEF }; }
  }
  function saveSettings(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function cachedProfile() {
    try { return JSON.parse(localStorage.getItem("dt_profile_cache") || "null"); }
    catch (e) { return null; }
  }

  async function ensurePermission() {
    if (!LN) return false;
    try {
      let st = await LN.checkPermissions();
      if (st.display !== "granted") st = await LN.requestPermissions();
      return st.display === "granted";
    } catch (e) { return false; }
  }

  const hm = (t) => {
    const [h, m] = String(t || "0:0").split(":").map(Number);
    return { hour: h || 0, minute: m || 0 };
  };
  const t12 = (h, m) => `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;

  /* 설정에 맞춰 전체 재예약 (기존 예약 모두 취소 후 다시)
     opts.prompt=false 면 권한 요청 팝업 없이 이미 허용된 경우에만 예약 (앱 실행 시 자가 치유용) */
  async function resync(profile, opts) {
    if (!LN) return false;
    const prompt = !opts || opts.prompt !== false;
    const s = getSettings();
    try {
      const pend = await LN.getPending();
      if (pend.notifications && pend.notifications.length) {
        await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
      }
    } catch (e) {}

    if (prompt) { if (!(await ensurePermission())) return false; }
    else {
      try { if ((await LN.checkPermissions()).display !== "granted") return false; }
      catch (e) { return false; }
    }

    const p = profile || cachedProfile();
    const isExam = !p || p.user_type !== "general";   // 알 수 없으면 수험생 문구
    const list = [];

    if (s.morning) list.push({
      id: 1001, badge: 1,
      title: "오늘 계획 세울 시간이에요",
      body: isExam ? "오늘의 핵심 과제를 입력하고 하루를 시작해보세요." : "오늘 할 일을 정리하고 하루를 시작해보세요.",
      schedule: { on: hm(s.morningTime), allowWhileIdle: true },
    });
    if (s.evening) list.push({
      id: 1002, badge: 1,
      title: "오늘 하루 기록할 시간이에요",
      body: isExam ? "오늘의 성과를 기록하고 마무리해보세요." : "오늘 하루를 정리하고 마무리해보세요.",
      schedule: { on: hm(s.eveningTime), allowWhileIdle: true },
    });

    if (s.wake) list.push({
      id: 1003, badge: 1,
      title: "좋은 아침이에요 ☀️",
      body: "오늘 일정을 확인하고 하루를 시작해보세요.",
      schedule: { on: hm(s.wakeTime), allowWhileIdle: true },
    });
    if (s.sleep) list.push({
      id: 1004, badge: 1,
      title: "이제 잘 시간이에요 🌙",
      body: "자기 전에 내일 일정을 확인해보세요.",
      schedule: { on: hm(s.sleepTime), allowWhileIdle: true },
    });

    if (s.timebox && isExam && p && p.id && window.supabaseClient) {
      try {
        const { data: boxes } = await supabaseClient.from("timeboxes")
          .select("*").eq("student_id", p.id).order("start_time");
        let id = 2000, tbCount = 0;
        outer:
        for (const b of (boxes || [])) {
          const days = Array.isArray(b.days) ? b.days : [0, 1, 2, 3, 4, 5, 6];
          const [h, m] = b.start_time.split(":").map(Number);
          for (const d of days) {                       // 월=0..일=6 → iOS weekday 일=1..토=7
            if (tbCount >= 40) break outer;             // iOS 예약 한도(64) 배분: 타임박스 최대 40
            list.push({
              id: id++, badge: 1,
              title: b.label,
              body: `타임박스 시작 시간이에요 (${t12(h, m)})`,
              schedule: { on: { weekday: ((d + 1) % 7) + 1, hour: h, minute: m }, allowWhileIdle: true },
            });
            tbCount++;
          }
        }
      } catch (e) {}
    }

    /* 일정 알림 (핀로그 일정, alert_min 설정된 것 — 토글과 무관하게 일정별로 동작) */
    if (p && p.id && window.supabaseClient) {
      try {
        const nowD = new Date();
        const in35 = new Date(Date.now() + 35 * 86400000);
        const [one, rep] = await Promise.all([
          supabaseClient.from("events").select("*").eq("user_id", p.id)
            .is("repeat", null).not("alert_min", "is", null)
            .gte("start_at", nowD.toISOString()).lte("start_at", in35.toISOString())
            .order("start_at").limit(18),
          supabaseClient.from("events").select("*").eq("user_id", p.id)
            .not("repeat", "is", null).not("alert_min", "is", null).limit(18),
        ]);
        let id = 3000, evCount = 0;
        const bodyOf = (ev) => {
          const st = new Date(ev.start_at);
          return ev.all_day ? "오늘 일정이에요" : `${t12(st.getHours(), st.getMinutes())} 일정이에요`;
        };
        for (const ev of (one.data || [])) {
          if (evCount >= 18) break;
          const at = new Date(new Date(ev.start_at).getTime() + ev.alert_min * 60000);
          if (at <= new Date()) continue;
          list.push({ id: id++, badge: 1, title: ev.title, body: bodyOf(ev), schedule: { at, allowWhileIdle: true } });
          evCount++;
        }
        for (const ev of (rep.data || [])) {
          if (evCount >= 18) break;
          const base = new Date(new Date(ev.start_at).getTime() + ev.alert_min * 60000);
          const hmOn = { hour: base.getHours(), minute: base.getMinutes() };
          const on =
            ev.repeat === "daily" ? hmOn :
            ev.repeat === "weekly" ? { weekday: base.getDay() + 1, ...hmOn } :
            ev.repeat === "monthly" ? { day: base.getDate(), ...hmOn } :
            { month: base.getMonth() + 1, day: base.getDate(), ...hmOn };
          list.push({ id: id++, badge: 1, title: ev.title, body: bodyOf(ev), schedule: { on, allowWhileIdle: true } });
          evCount++;
        }
      } catch (e) {}
    }

    /* 할 일 알림 (remind_time "HH:MM" 설정된 미완료 할 일 — 오늘~14일) */
    if (p && p.id && window.supabaseClient) {
      try {
        const pad2 = (n) => String(n).padStart(2, "0");
        const iso = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        const in14 = new Date(Date.now() + 14 * 86400000);
        const { data: tds } = await supabaseClient.from("todos")
          .select("id,content,date,remind_time").eq("student_id", p.id)
          .eq("done", false).not("remind_time", "is", null)
          .gte("date", iso(new Date())).lte("date", iso(in14))
          .order("date").limit(10);
        let id = 4000;
        for (const t of (tds || [])) {
          const [h, m] = String(t.remind_time).split(":").map(Number);
          const [y, mo, d] = String(t.date).split("-").map(Number);
          const at = new Date(y, mo - 1, d, h || 0, m || 0);
          if (at.getTime() <= Date.now()) continue;
          list.push({
            id: id++, badge: 1,
            title: t.content,
            body: "할 일 알림이에요 (" + t12(h || 0, m || 0) + ")",
            schedule: { at, allowWhileIdle: true },
          });
        }
      } catch (e) {}
    }

    if (list.length) await LN.schedule({ notifications: list });
    return true;
  }

  /* 알림 탭 → 관련 화면으로 */
  if (LN) {
    LN.addListener("localNotificationActionPerformed", (a) => {
      const id = a && a.notification && a.notification.id;
      if (id >= 4000) window.location.href = "/index.html";
      else if (id >= 3000 || id === 1003 || id === 1004) window.location.href = "/calendar.html";
      else if (id >= 2000) window.location.href = "/timebox.html";
      else window.location.href = "/index.html";
    });
  }

  /* 앱을 열거나 복귀하면 아이콘 배지·알림 센터 항목 정리 */
  function clearBadge() { try { LN.removeAllDeliveredNotifications(); } catch (e) {} }
  if (LN) {
    const AppPlugin = window.Capacitor.Plugins.App;
    if (AppPlugin) AppPlugin.addListener("appStateChange", ({ isActive }) => { if (isActive) clearBadge(); });
  }

  /* 앱 실행 시 자가 치유 재예약 — 권한 팝업 없이(이미 허용된 경우만), 일정 알림 포함 */
  document.addEventListener("DOMContentLoaded", () => {
    if (!LN) return;
    clearBadge();
    setTimeout(() => resync(null, { prompt: false }), 4000);
  });

  /* 진단용: 5초 뒤 테스트 알림 */
  async function test() {
    if (!LN || !(await ensurePermission())) return false;
    try {
      await LN.schedule({ notifications: [{
        id: 999, badge: 1,
        title: "핀로그 알림 테스트",
        body: "알림이 정상 작동하고 있어요!",
        schedule: { at: new Date(Date.now() + 5000) },
      }] });
      return true;
    } catch (e) { return false; }
  }

  /* 진단용: 현재 예약된 알림 개수 (-1 = 확인 실패) */
  async function pendingCount() {
    if (!LN) return -1;
    try { return ((await LN.getPending()).notifications || []).length; }
    catch (e) { return -1; }
  }

  window.dtNotify = { available: !!LN, getSettings, saveSettings, resync, ensurePermission, test, pendingCount };
})();
