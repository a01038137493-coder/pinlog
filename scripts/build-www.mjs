/*
 * build-www.mjs
 * ------------------------------------------------------------
 * Capacitor 앱 번들용 www/ 폴더 생성.
 * 저장소 루트에서 앱에 필요한 웹 파일만 복사한다.
 * (sql, marketing, plant-tamagotchi, node_modules 등 제외)
 *
 * 실행: npm run build:www
 * ------------------------------------------------------------
 */
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";

const OUT = "www";

const COPY = [
  "index.html",
  "welcome.html",
  "auth-return.html",
  "onboarding.html",
  "login.html",
  "signup.html",
  "privacy.html",
  "files.html",
  "memo.html",
  "memo-edit.html",
  "support.html",
  "settings.html",
  "notifications.html",
  "mypage.html",
  "mypage-edit.html",
  "demo.html",
  "student.html",
  "student-m.html",
  "general-m.html",
  "general.html",
  "guide.html",
  "timebox.html",
  "calendar.html",
  "checkin.html",
  "checkout.html",
  "weekly-goal.html",
  "weekly-review.html",
  "my-history.html",
  "admin.html",
  "alerts.html",
  "student-detail.html",
  "css",
  "js",
  "assets",
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const p of COPY) {
  if (!existsSync(p)) {
    console.warn(`⚠️  없음(건너뜀): ${p}`);
    continue;
  }
  cpSync(p, `${OUT}/${p}`, { recursive: true });
  copied++;
}

console.log(`✅ www/ 생성 완료 — ${copied}/${COPY.length}개 항목 복사`);
