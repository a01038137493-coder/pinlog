/*
 * auth.js
 * ------------------------------------------------------------
 * 로그인 페이지(login.html) 전용 스크립트.
 * - 이미 로그인된 사용자는 role 에 맞는 페이지로 보냄
 * - 이메일/비밀번호 로그인 처리
 * - 모든 에러 메시지는 한국어로 표시
 * ------------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("login-form");
  const errorBox = document.getElementById("login-error");

  // 아직 Supabase 키를 채우지 않은 경우: 명확히 안내하고 종료
  if (!isSupabaseConfigured()) {
    errorBox.textContent =
      "Supabase 설정이 필요합니다. js/supabaseClient.js 에 URL과 anon key를 입력해주세요.";
    return;
  }

  // 목업(데모) 모드: 원탭 로그인 버튼 노출 + 연결
  if (window.DT_MOCK) {
    const demo = document.getElementById("demo-login");
    if (demo) {
      demo.hidden = false;
      demo.querySelectorAll("[data-demo]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          errorBox.textContent = "";
          const email = btn.dataset.demo === "admin" ? "admin@demo.com" : "student@demo.com";
          await supabaseClient.auth.signInWithPassword({ email, password: "demo" });
          const p = await getCurrentProfile();
          if (p) redirectByRole(p.role);
          else errorBox.textContent = "데모 계정을 불러오지 못했습니다.";
        });
      });
    }
  }

  // 이미 로그인되어 있으면 바로 역할별 페이지로 이동 (네트워크 오류는 무시하고 로그인 화면 유지)
  try {
    const profile = await getCurrentProfile();
    if (profile) {
      redirectByRole(profile.role);
      return;
    }
  } catch (e) {
    /* 세션 확인 실패 시 로그인 폼을 그대로 보여준다 */
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      errorBox.textContent = "이메일과 비밀번호를 모두 입력해주세요.";
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "로그인 중...";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      errorBox.textContent = "로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.";
      submitBtn.disabled = false;
      submitBtn.textContent = "로그인";
      return;
    }

    // 로그인 성공 → 프로필 role 에 따라 분기
    const newProfile = await getCurrentProfile();
    if (!newProfile) {
      errorBox.textContent = "프로필 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.";
      submitBtn.disabled = false;
      submitBtn.textContent = "로그인";
      return;
    }
    redirectByRole(newProfile.role);
  });
});

/* role 별 시작 페이지로 이동 (?next= 로 온 경우 그 페이지로 복귀) */
function redirectByRole(role) {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    window.location.href = next;
    return;
  }
  if (role === "student") {
    window.location.href = "/student.html";
  } else {
    // admin, counselor 는 관리자 대시보드로
    window.location.href = "/admin.html";
  }
}
