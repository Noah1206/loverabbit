# 러브레빗 콘텐츠 제작 계획 (Higgsfield AI)

상태: CLI 설치·인증·스킬 설치 완료. 계정이 grace 기간 일일 한도 소진 상태 → 한도 리셋 또는 플랜 업그레이드 후 위에서부터 순서대로 생성.

공통 스타일 키워드: `dark romantic Korean webtoon illustration, deep violet night palette, hot pink rim light, painterly, highly detailed, no text`

---

## 1순위 — 웹앱 UI 필수 (이미지)

### ① 상품 카드 일러스트 6장 — `nano_banana_2`, 3:4
홈 카드/히어로의 `CardArt` 컴포넌트를 `<img>`로 교체. 저장 위치: `public/cards/<카테고리>.jpg`

| 파일 | 프롬프트 요지 |
|---|---|
| sokgunghap | 보름달 아래 흑·진홍 한복 남녀가 마주 선 채 새끼손가락에 붉은 실(홍연), 촛불 |
| jaehoe | 갓 쓴 잘생긴 남자 무당, 얼굴 반은 그림자, 촛불·향 연기·부적 |
| bamgijil | 흰 토끼 가면을 얼굴 옆에 든 실크 한복 여인, 커튼 사이 달빛, 야릇한 미소 |
| hwanseung | 네온 교차로에서 반대로 걷는 두 남자 실루엣 사이의 여자, 바람에 날리는 머리 |
| sseom | 어두운 카페, 폰 불빛을 사이에 두고 키스 직전까지 기운 남녀, 홍조 |
| ibyeol | 검은 책상 위 마른 장미·찢긴 연애편지·커플 사진·돋보기, 촛불 하나 (인물 없음) |

### ② 브랜드 로고·심볼 — `recraft_v4_1 --model_type vector`, 1:1
초승달을 안은 토끼 실루엣 마크, 핑크(#ff3d7f)+바이올렛, 미니멀 벡터. → 상단바 로고·파비콘·앱아이콘

### ③ OG 공유 썸네일 — `gpt_image_2`, 16:9 (1200×630)
"LOVERABBIT" 타이포 + 달토끼, 다크퍼플 배경. → 링크 공유 시 첫인상 (layout metadata에 og:image 등록)

### ④ 공유 결과 카드 배경 — `nano_banana_2`, 3:4
현재 canvas 그라데이션 배경을 일러스트 배경으로 업그레이드 (바이럴 이미지 퀄리티 상승)

## 2순위 — 마케팅 (Week 2 로드맵 연동)

### ⑤ 릴스/쇼츠 후킹 영상 3종 — `seedance_2_0`, 9:16, 5~8초
①번 카드 일러스트를 `--start-image`로 애니메이션화. 속궁합("그 사람과 밤에도 잘 맞을까") / 재회("아직 남은 정일까") / 밤기질("네 욕망 코드"). 자막은 캡컷/앱에서 후반 작업.

### ⑥ 광고 정지 이미지 3종 — `marketing_studio_image` 또는 `gpt_image_2`, 4:5
메타 광고 A/B용. 다크 버전 vs 파스텔 버전 각각 제작해 테마 A/B 테스트와 연동.

### ⑦ 인스타 계정 세팅 — `nano_banana_2`
프로필 이미지 1장 + 그리드 시딩용 무드 이미지 9장 (후킹 문구는 앱에서 오버레이)

## 3순위 — 확장

### ⑧ 파스텔 버전 카드 6장 — ①과 동일 구도, 파스텔 팔레트 (테마 A/B 완주용)
### ⑨ Virality Predictor — ⑤ 영상 제작 후 `brain_activity`로 후킹 점수 분석 → 광고 집행 전 크리에이티브 선별

---

## 실행 메모

- 생성 명령 예: `higgsfield generate create nano_banana_2 --prompt "..." --aspect_ratio 3:4 --wait`
- 완성 이미지는 `public/cards/`에 저장 후 `CardArt` 교체 → `npm run build` → `npx vercel --prod`
- 한도 상태 확인: `higgsfield account status`
