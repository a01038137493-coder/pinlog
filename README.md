# 핀로그

학생 개인용 **공부 기록·목표 트래커** iOS 앱입니다.
매일 목표를 세우고(체크인), 실제 성과를 기록하고(체크아웃), 누적 데이터로 나의 공부를 관리합니다.

> 핀로그(재수학원용 웹앱)를 기반으로 **개인용(B2C) 앱**으로 전환 중입니다.
> 현재 남아 있는 관리자/상담 기능은 제거 예정이며, 자체 회원가입·온보딩·계정 삭제가 추가됩니다.

- **Frontend**: 순수 HTML / CSS / Vanilla JS (프레임워크 없음)
- **Backend / DB / Auth**: Supabase
- **App**: Capacitor 8 (iOS, 앱스토어 출시 목표)
- 모바일 우선 반응형, 한국어 UI

---

## 1. Supabase 설정

1. [supabase.com](https://supabase.com) 에서 새 프로젝트를 만듭니다.
2. **SQL Editor** 에서 다음 순서로 실행합니다.
   - `sql/01_schema.sql` (테이블 생성)
   - `sql/02_rls.sql` (RLS 정책 + is_admin 함수)
3. **Settings → API** 에서 아래 두 값을 복사합니다.
   - `Project URL`  → `SUPABASE_URL`
   - `anon public`  → `SUPABASE_ANON_KEY`
4. `js/supabaseClient.js` 상단의 두 상수를 복사한 값으로 교체합니다.

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi....";
```

> ⚠️ 프론트엔드에는 **anon public key 만** 넣습니다. `service_role key` 는 절대 넣지 않습니다.

---

## 2. 테스트 계정 만들기

1. Supabase **Authentication → Users → Add user** 로 계정을 만듭니다.
   - 학생 2명, 관리자 1명 (이메일 + 비밀번호, "Auto Confirm" 체크)
2. 각 유저의 `User UID` 를 복사합니다.
3. **SQL Editor** 에서 `profiles` 에 역할을 넣습니다. (id = auth user UID)

```sql
insert into profiles (id, role, name, seat_number, target_university, status)
values
  ('학생1-UID', 'student', '김학생', 'A-01', '서울대', 'active'),
  ('학생2-UID', 'student', '이학생', 'A-02', '연세대', 'active'),
  ('관리자-UID', 'admin',   '원장',   null,   null,     'active');
```

> 컨설턴트(counselor)는 `role`을 `'counselor'`로 넣으면 관리자와 동일하게 동작합니다.

---

## 3. 로컬에서 실행

정적 파일이라 어떤 정적 서버로도 열 수 있습니다. (절대 경로 `/student.html` 사용 때문에 `file://` 직접 열기보다 서버 권장)

```bash
cd pinlog
python3 -m http.server 5500
# 브라우저에서 http://localhost:5500 접속
```

---

## 4. Vercel 배포

```bash
cd pinlog
npx vercel        # 미리보기 배포
npx vercel --prod # 프로덕션 배포
```

또는 이 폴더를 GitHub 저장소에 올리고 Vercel 대시보드에서 Import 하면 됩니다.
빌드 명령 없이 정적 파일이 그대로 배포됩니다.

> 참고: 정적 배포라 빌드 단계에서 환경변수를 주입할 수 없어, MVP에서는 키를 `js/supabaseClient.js`에 직접 적습니다. anon key 는 원래 공개되는 값이라 RLS 가 보안을 담당합니다. 실서비스 강화가 필요하면 빌드 도구나 서버리스 함수로 키 주입 구조를 검토하세요.

---

## 5. 화면 구성

| 경로 | 설명 | 권한 |
|---|---|---|
| `/login.html` | 로그인 (role 따라 분기) | 전체 |
| `/student.html` | 학생 홈 (오늘 상태·다음 행동 강조) | student |
| `/checkin.html` | 오늘 목표 입력 (등원) | student |
| `/checkout.html` | 오늘 성과 기록 (하원, 달성률 자동) | student |
| `/weekly-goal.html` | 이번 주 목표 (월요일) | student |
| `/weekly-review.html` | 주간 회고 (토요일) | student |
| `/my-history.html` | 내 기록 보기 | student |
| `/admin.html` | 관리자 대시보드 (누구를 부를지) | admin/counselor |
| `/student-detail.html?id=…` | 학생 상세 + 개입 기록 | admin/counselor |

---

## 6. 자동 계산 / 상담 필요 판단

- **하루 달성률** = 실제 총 시간 / 목표 총 시간 × 100 (목표 0이면 0%, 표시는 최대 150%)
- **주간 달성률** = 주간 실제 시간 / 주간 목표 시간 × 100
- 관리자 대시보드는 다음 학생을 자동으로 모아 보여줍니다.
  - 체크인/체크아웃 미완성
  - 오늘 달성률 50% 이하
  - 최근 3일 컨디션 2점 이하 2회 이상
  - 주간 목표 달성률 60% 이하
  - 최근 2일 연속 체크아웃 미완성
  - 위 조건 또는 `needs_consulting` 체크 시 "상담 필요"로 집계

---

## 7. iOS 앱 (Capacitor)

웹 코드를 그대로 iOS 앱으로 감싸는 Capacitor 세팅이 되어 있습니다.

```bash
npm install          # 의존성 설치
npm run build:www    # 앱 번들용 www/ 생성 (sql, marketing 등 제외)
npm run ios:sync     # www 빌드 + iOS 프로젝트에 동기화
npm run ios:open     # (맥 전용) Xcode 열기
```

- 네이티브 프로젝트: `ios/App/App.xcodeproj` (Swift Package Manager 기반, CocoaPods 불필요)
- 앱 ID: `com.pinlog.app` / 표시 이름: 핀로그 (`capacitor.config.json`)
- supabase-js 는 CDN 대신 `js/vendor/supabase.js` 로컬 번들 사용 (앱 오프라인 셸 대응)
- 노치/홈바 대응: 모든 HTML 에 `viewport-fit=cover` + `css/style.css` 하단 safe-area 패딩
- 빌드 검증: GitHub Actions → **iOS build (unsigned)** 워크플로 (맥 없이 컴파일 확인)

> 웹 파일을 수정하면 `npm run ios:sync` 를 다시 실행해야 앱에 반영됩니다.

## 8. 수능 D-day 변경

`js/utils.js` 상단의 `SUNEUNG_DATE` 값을 매년 수정하세요. (현재: `2026-11-19`)

## 9. 파일 구조

```
pinlog/
  index.html              # 로그인 여부에 따라 자동 분기
  login.html
  student.html  checkin.html  checkout.html
  weekly-goal.html  weekly-review.html  my-history.html
  admin.html  student-detail.html
  css/style.css
  js/
    supabaseClient.js  utils.js  auth.js
    student.js  checkin.js  checkout.js
    weeklyGoal.js  weeklyReview.js  history.js
    admin.js  studentDetail.js
  sql/
    01_schema.sql  02_rls.sql
  assets/logo.svg
  vercel.json
```
