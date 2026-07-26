# 로그 · 인스타그램 광고 피드 (5종)

- **타겟**: 학생 + 학부모 혼합
- **톤·비주얼**: 동기부여·강렬 (큰 타이포, 강한 카피)
- **규격**: 1:1 정사각형 (1080×1080) — 캐러셀/단일 피드 겸용
- **퍼널 순서**: ① 후킹 → ② 사용법 → ③ 디데이 → ④ 신뢰 → ⑤ CTA(데모)
- **디자인 카드(미리보기)**: `marketing/insta-feed.html` (브라우저로 열어 캡처)

> 각 피드는 **이미지에 들어갈 문구 + 비주얼 컨셉 + AI 이미지 프롬프트 + 캡션 + 해시태그** 한 세트입니다.

---

## 공통 브랜드 스타일 (프롬프트 앞에 붙여 쓰기)

> **[BRAND STYLE]** premium Instagram ad creative, 1:1 square (1080×1080), deep navy gradient background (#0f1b35 → #1b2c52), accent colors coral-red (#ff5a4d) and mustard-yellow (#ffd23f), modern minimal Korean exam-prep brand "로그", bold sans-serif Korean typography as the hero, generous negative space, flat high-contrast design, subtle film grain, sharp clean vector style, premium app advertising look, small wordmark "● 로그" top-left.

색상 참고: 네이비 `#0f1b35`·`#1b2c52` / 코랄 `#ff5a4d` / 옐로 `#ffd23f` / 페이퍼 `#f4f1ea`

---

## ① 후킹 — “스크롤 멈추는 한 방”

**이미지 문구**
- 윗줄(작게, 옐로): `재수, 다시 시작`
- 헤드라인(크게): `출석은 매일 했는데 / 성적은 왜 그대로일까?` — ‘성적’에 코랄 밑줄
- 서브: `문제는 노력의 양이 아니라 관리입니다` — ‘관리’ 옐로
- 푸터: `pinlog.vercel.app`

**비주얼 컨셉**: 텍스트 중심 포스터. 배경에 ‘쭉 평평하다가 끝에서 솟구치는’ 그래프 라인 희미하게.

**AI 프롬프트**
> [BRAND STYLE] Bold typographic poster, text-forward. Faint background motif: a flat heart-rate-style line that suddenly rises at the end. Render this exact Korean text large and centered: headline **"출석은 매일 했는데 성적은 왜 그대로일까?"** with the word **"성적"** marked by a hand-drawn coral underline; small yellow eyebrow top **"재수, 다시 시작"**; subtext **"문제는 노력의 양이 아니라 관리입니다"** with **"관리"** in mustard-yellow; tiny footer **"pinlog.vercel.app"**. Mood: confrontational, motivating. `--ar 1:1 --style raw`

**캡션**
```
“오늘도 자리에 앉아는 있었는데… 뭘 했는지 모르겠다.”

재수는 출석이 아니라 ‘성과’로 관리해야 합니다.
로그는 매일의 목표와 실제 결과를 기록해, 흐릿한 하루를 또렷한 데이터로 바꿔줍니다. 📈

지금 계정 없이 체험 👉 프로필 링크
```
**해시태그**
`#재수 #재수생 #반수 #n수 #수능 #공부자극 #학습관리 #스터디플래너 #목표관리 #공부기록`

---

## ② 사용법 — “하루 2분”

**이미지 문구**
- 윗줄(옐로): `하루 딱 2분`
- 헤드라인: `아침엔 목표를 적고 / 저녁엔 성과를 남긴다` — ‘목표’ 옐로, ‘성과’ 코랄
- 서브: `체크인·체크아웃으로 매일이 데이터가 됩니다`
- 칩 3개: `✅ 오늘 과제` · `⏱️ 공부시간` · `📈 달성률`

**비주얼 컨셉**: 좌(아침 햇살)–우(밤 달빛) 분할, 하단 글래스 칩 3개.

**AI 프롬프트**
> [BRAND STYLE] Split day-night concept: left side warm sunrise glow, right side cool moonlight. Render exact Korean text: eyebrow **"하루 딱 2분"** (yellow); headline **"아침엔 목표를 적고 저녁엔 성과를 남긴다"** with **"목표"** in yellow and **"성과"** in coral; subtext **"체크인·체크아웃으로 매일이 데이터가 됩니다"**; three rounded glass pill chips in a row reading **"✅ 오늘 과제"**, **"⏱️ 공부시간"**, **"📈 달성률"**. Clean, friendly-premium. `--ar 1:1 --style raw`

**캡션**
```
거창한 계획표는 3일이면 무너지죠.
로그는 딱 두 번이면 끝납니다.

🌅 등원 — 오늘 핵심 과제 체크인
🌙 하원 — 실제 성과 체크아웃 (달성률 자동 계산)

쌓인 기록이 내일의 전략이 됩니다.

체험하기 👉 프로필 링크
```
**해시태그**
`#재수생 #스터디플래너 #공부계획 #학습관리 #수능공부 #공스타그램 #열공 #목표관리`

---

## ③ 디데이 — “긴장감”

**이미지 문구**
- 윗줄(코랄): `2026 수능`
- 임팩트 숫자(초대형, 코랄): `D-150`
- 서브: `남은 시간, 감으로 보낼래 데이터로 채울래?` — ‘데이터’ 강조
- 푸터: `매일 자동 카운트다운 · pinlog`

**비주얼 컨셉**: 더 어두운 플럼-네이비 그라데이션, 거대한 숫자 중심, 모래시계/달력 모티프 희미하게.

**AI 프롬프트**
> [BRAND STYLE] but darker dramatic gradient (deep plum-navy #2a1430 → #0c0a1f). Giant impact number **"D-150"** in coral filling the center, faint hourglass/calendar motif behind it. Eyebrow **"2026 수능"** in coral. Subtext under the number: **"남은 시간, 감으로 보낼래 데이터로 채울래?"** with **"데이터"** emphasized. Footer **"매일 자동 카운트다운 · pinlog"**. Mood: urgent, cinematic, high tension. `--ar 1:1 --style raw`

**캡션**
```
오늘이 며칠 남았는지보다, 그 하루를 어떻게 썼는지가 등급을 바꿉니다.

로그 홈엔 수능 D-day가 항상 떠 있고, 그 아래 오늘의 목표·성과가 함께 쌓입니다. ⏳

남은 날을 데이터로 채우는 법, 지금 확인하세요 👉 프로필 링크
(* 디데이 숫자는 앱에서 매일 자동 갱신됩니다)
```
**해시태그**
`#수능 #수능디데이 #재수 #재수생 #디데이 #공부자극 #동기부여 #수험생 #열공스타그램`

> 메모: `D-150`은 캠페인 시작일 기준 숫자입니다. 시작일에 맞춰 숫자만 교체해 재생성하세요.

---

## ④ 신뢰 — “학생도, 학부모도”

**이미지 문구**
- 윗줄(옐로): `학생도, 학부모도`
- 헤드라인: `오늘 뭐 했는지 / 숫자로 보입니다` — ‘숫자’ 코랄 밑줄
- 서브: `달성률·컨디션·주간 회고까지 한눈에, 막연한 불안 대신 데이터로`
- 푸터: `pinlog.vercel.app`

**비주얼 컨셉**: 차분·신뢰. 배경에 상승하는 진행 링 + 미니 막대 차트 은은하게.

**AI 프롬프트**
> [BRAND STYLE] Calm, trustworthy. Background motif: a rising progress ring and a small clean bar chart, softly glowing. Render exact Korean text: eyebrow **"학생도, 학부모도"** (yellow); headline **"오늘 뭐 했는지 숫자로 보입니다"** with **"숫자"** underlined in coral; subtext **"달성률·컨디션·주간 회고까지 한눈에, 막연한 불안 대신 데이터로"**; footer **"pinlog.vercel.app"**. Mood: reassuring, professional, warm. `--ar 1:1 --style raw`

**캡션**
```
“공부 잘 돼?” “…응.”
이 대화, 이제 그만.

로그는 매일의 달성률과 컨디션, 주간 회고를 데이터로 남깁니다.
학생은 스스로를 객관적으로 보고, 부모님은 잔소리 대신 흐름을 봅니다. 🤝

오늘의 성과, 숫자로 확인하기 👉 프로필 링크
```
**해시태그**
`#재수 #학부모 #자녀교육 #입시맘 #수험생부모 #학습관리 #성적관리 #재수생 #메타인지`

---

## ⑤ CTA — “데모 체험”

**이미지 문구**
- 윗줄(흰색): `지금 바로`
- 헤드라인(흰색, 초대형): `계정 없이 둘러보기`
- 서브: `가입·결제 없이 클릭 한 번이면 데모가 열려요`
- 버튼/URL: `체험하기 →` · `pinlog.vercel.app`

**비주얼 컨셉**: 코랄-레드 그라데이션(다른 컷과 대비), 탭하는 손가락/커서 아이콘, 흰색 알약 버튼.

**AI 프롬프트**
> Vivid coral-red gradient background (#ff5a4d → #8f1f2a) — contrast against the navy posts. Small white wordmark "● 로그" top-left. Eyebrow **"지금 바로"** (white). Huge white bold Korean headline **"계정 없이 둘러보기"**; a tapping finger / mouse-cursor click icon; subtext **"가입·결제 없이 클릭 한 번이면 데모가 열려요"**; a white rounded pill button reading **"체험하기 →"** in coral text; large url **"pinlog.vercel.app"**. Energetic, action-driving. 1:1 square, bold flat premium style. `--ar 1:1 --style raw`

**캡션**
```
백 마디 설명보다 1분 체험.

링크 들어가서 ‘학생으로 둘러보기’만 누르면, 실제 데모가 바로 열립니다. (가입 X)
체크인부터 대시보드 위젯, 달성률까지 직접 만져보세요. 👆

👉 pinlog.vercel.app
프로필 링크에서도 바로 연결돼요!
```
**해시태그**
`#로그 #재수 #재수생 #수능 #스터디앱 #공부앱 #학습관리 #무료체험 #입시`

---

## 이미지 생성 도구 팁

- **한글 정확도**: Midjourney는 한글을 자주 깨뜨립니다. 글자까지 정확히 넣으려면 **GPT 이미지(ChatGPT) · Google Gemini(이미지) · Ideogram 3.0**을 추천.
- **Midjourney 사용 시**: 따옴표 안 한글은 빼고 배경/분위기만 생성 → 글자는 Canva/포토샵으로 얹기. (`--ar 1:1 --v 7 --style raw`)
- **5장 톤 통일**: 같은 시드 또는 스타일 레퍼런스 사용. Midjourney `--sref <①번 이미지 URL>`, GPT/Gemini는 “①번과 동일한 스타일·색·폰트로” 이어서 지시.
- **세로형(스토리/릴스)**: 9:16이 필요하면 `--ar 9:16`로, 헤드라인을 위 1/3에 배치하도록 지시.
