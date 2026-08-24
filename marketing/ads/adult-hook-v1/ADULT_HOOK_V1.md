# 성인 타겟 후킹 광고 3종 (adult-hook-v1)

Manus 명세를 받아 만든 소재다. 명세의 첫 요구는 **"원본 배경을 훼손하지 않는다"** 였고,
그 요구 때문에 이미지 모델을 쓰지 않았다. 이유는 아래 "왜 AI 로 안 그렸나" 에 적었다.

생성:

```
node marketing/ads/compose-adult-hook-v1.mjs
```

문구를 고치려면 `marketing/ads/compose-adult-hook-v1.mjs` 위쪽 `campaigns` 배열만
고치고 다시 돌리면 된다. 배경은 `public/ads/saju/` 의 원본을 그대로 읽는다.

---

## 3종 요약

| | 시안 | 배경 | 랜딩 | 배지 |
|---|---|---|---|---|
| 01 | 속궁합 강조형 | `intimate-compatibility-bg.png` | `/saju/intimate-compatibility` | 속궁합 사주 |
| 02 | 캐릭터 동반 몰입형 | `mature-compatibility-bg.png` | `/saju/mature-compatibility` | 19금 사주 |
| 03 | 궁합 타이밍형 | `romance-timing-bg.png` | `/saju/romance-timing` | 올해의 연애운 (인연 타이밍이 합쳐졌다) |

### 01 속궁합 강조형

- 메인: 겉으로 보이는 궁합이 / **전부는 아니니까요.**
- 보충: 남들에게 말 못 할 두 사람만의 진짜 궁합
- CTA: 무료로 속궁합 확인하기 →
- UI 요소: 사주 그리드 (성향 · 온도 · 타이밍 · 거리감)

### 02 캐릭터 동반 몰입형

- 메인: 당신의 밤을 위한 / **특별한 사주풀이**
- 보충: 매력적인 캐릭터가 직접 들려주는 당신의 운명 이야기
- CTA: 캐릭터 만나고 무료 사주 보기 →
- UI 요소: 대화 말풍선 2개
- 하단에 `만 19세 이상` 고지가 붙는다 (이 시안만).

### 03 궁합 타이밍형

- 메인: 우리의 인연이 깊어지는 / **진짜 타이밍**
- 보충: 스쳐 갈 인연인지, 오래 갈 인연인지
- CTA: 무료로 연애 타이밍 확인하기 →
- UI 요소: 타임라인 눈금 + "여기쯤" 마커

---

## 파일

시안마다 4개씩, 총 12개 + 대지 1장.

```
01-intimate-hook-feed-1080x1350.{png,jpg}     피드 / 4:5
01-intimate-hook-story-1080x1920.{png,jpg}    릴스 · 스토리 / 9:16
02-character-night-...                        (동일 4종)
03-timing-hook-...                            (동일 4종)
adult-hook-preview.{png,jpg}                  3종 한눈에 보는 대지
```

메타에 올릴 때는 **jpg** 를 쓴다. png 는 1.6~2.6MB 라 업로드가 느리고, 화질 차이는 없다.

4:5 와 9:16 을 둘 다 넣는 이유: 메타는 같은 소재라도 배치마다 자르는 위치가 달라서,
한 벌만 올리면 릴스에서 헤드라인이나 CTA 가 잘려 나간다.

---

## 링크 (UTM 포함)

랜딩 세 곳 모두 990원 오퍼가 붙어 있다 (`scripts/verify-ad-offers.mjs` 로 확인된 것).

```
01  https://loverebbit.xyz/saju/intimate-compatibility?utm_source=meta&utm_medium=paid&utm_campaign=adult_hook_v1&utm_content=01_intimate
02  https://loverebbit.xyz/saju/mature-compatibility?utm_source=meta&utm_medium=paid&utm_campaign=adult_hook_v1&utm_content=02_character_night
03  https://loverebbit.xyz/saju/romance-timing?utm_source=meta&utm_medium=paid&utm_campaign=adult_hook_v1&utm_content=03_timing
```

---

## 심사에서 걸릴 만한 것

메타는 성적으로 암시적인 소재를 거부한다. 지금 3종 중 걸릴 확률이 높은 순서:

1. **02 "당신의 밤을 위한"** — 배경이 밀착 장면인데 카피가 밤을 말한다. 둘이 겹치면
   심사가 성적 암시로 읽는다. 거부되면 카피를 `혼자 있는 밤에 보는 사주` 정도로
   낮추거나, 배경을 밀착이 덜한 것으로 바꾼다.
2. **01 "남들에게 말 못 할"** — 문구 자체는 무난하지만 배경과 같이 보면 경계선이다.
3. **03** — 가장 안전하다. 먼저 이걸로 심사를 통과시켜 계정 신뢰도를 올리고,
   01 · 02 를 뒤에 넣는 편이 낫다.

원 명세에 있던 `밤을 함께할 운명인지` 는 03 에서 뺐다. 03 은 안전판으로 쓸 소재인데
그 한 줄 때문에 같이 거부당하면 셋 다 못 돌린다.

---

## AI 버전 — 실제로 뽑아 본 결과

`ai-version/` 에 있다. `marketing_studio_image` · 4:5 · 3장 · 6크레딧
(장당 2크레딧, 2026-08-22 실행).

**미리 적어 뒀던 예측 하나가 틀렸다. 한글은 안 깨졌다.** 헤드라인 · 보충 · CTA 세
줄 모두 정확하게 나왔다. 받침도 멀쩡하다. 이 모델은 한글 타이포를 생각보다 잘 쓴다.

맞았던 예측은 배경 쪽이다. **세 장 다 배경이 다시 그려졌다.**

| | 무슨 일이 있었나 |
|---|---|
| 01 | 여자 드레스의 질감이 바뀌고 구도가 밀렸다. 우리 것이 아닌 **앱 헤더(프로필 원 + 햄버거 메뉴)** 가 위에 생겼다. 장식 그리드 안에 `ㅅ 로` 같은 깨진 글자 조각이 있다 |
| 02 | 크롭이 달라지면서 인물 배치가 재구성됐다. 정체불명의 원소 아이콘 5개가 하단에 생겼다 |
| 03 | 셋 중 원본에 가장 가깝다. 그래도 다시 그린 그림이다 |

그 밖에 손봐야 했던 것:

- **해상도 928×1152.** 메타 피드 4:5 권장(1080×1350)보다 작다.
- **브랜드도 고지도 없다.** `오락 목적의 콘텐츠입니다` 와 02 의 연령 고지가 빠졌다.

둘 다 `ai-version/finish-ai-version.mjs` 로 메꿨다. 잘라내지 않고 세로를 맞춘 뒤
(모델이 CTA 를 아래 끝에 붙여 놔서 cover 로 채우면 버튼이 잘린다) 하단에 브랜드
바를 얹는다. 결과가 `*-finished-1080x1350.{png,jpg}` 다.

```
node marketing/ads/adult-hook-v1/ai-version/finish-ai-version.mjs
node marketing/ads/adult-hook-v1/ai-version/build-compare-sheet.mjs
```

`ai-version/compare-local-vs-ai.jpg` 에 두 벌이 나란히 있다.

### 그래서 뭘 쓰나

**둘 다 돌려서 데이터로 정한다.** 두 벌 모두 4:5 1080×1350 이고, 카피도 랜딩도
같다. 광고 소재의 우열은 눈으로 정하는 게 아니다.

다만 **01 의 AI 버전은 빼는 편이 낫다.** 위에 생긴 앱 헤더는 우리 UI 가 아닌데
UI 처럼 보인다. 메타는 실제 기능이 아닌 인터페이스를 흉내 낸 소재를 거부한 전례가
있고, 깨진 글자 조각도 같이 걸린다.

AI 쪽의 강점은 헤드라인이 더 크고 화면을 꽉 채운다는 것이다. 이건 로컬 쪽에도
`campaigns` 의 `size` 값만 올리면 그대로 가져올 수 있다.

한 가지는 바뀌지 않는다. **AI 버전은 고칠 수가 없다.** 문구 한 글자를 바꾸려면
크레딧을 다시 쓰고, 레이아웃도 새로 뽑히므로 나머지 두 장과 톤이 어긋난다.
로컬 쪽은 배열 한 줄 고쳐 2초면 12장이 다시 나온다. 그래서 운영용 기본은 로컬로
두고, AI 는 소재 변주를 늘리는 용도로 쓴다.

### 재실행용 페이로드

배경 3장을 `media_upload` 로 올려 `media_id` 를 채운 뒤 `generate_image_batch` 에
넣는다. 크레딧을 쓰므로 승인 후에만 실행한다.

```json
{
  "requests": [
    {
      "index": 1,
      "params": {
        "model": "marketing_studio_image",
        "aspect_ratio": "4:5",
        "count": 1,
        "medias": [{ "role": "image", "value": "<intimate-compatibility-bg 의 media_id>" }],
        "prompt": "Keep the provided reference image exactly as the background without altering its content. Overlay premium Meta ad typography and UI elements on top of it. Typography layout: Large, bold, clean Korean text in the center reading \"겉으로 보이는 궁합이 전부는 아니니까요.\". Below it, smaller readable Korean text reading \"남들에게 말 못 할 두 사람만의 진짜 궁합\". At the bottom, a clear CTA button or banner with Korean text \"무료로 속궁합 확인하기\". Add subtle saju grid UI elements around the text to enhance the fortune-telling app atmosphere."
      }
    },
    {
      "index": 2,
      "params": {
        "model": "marketing_studio_image",
        "aspect_ratio": "4:5",
        "count": 1,
        "medias": [{ "role": "image", "value": "<mature-compatibility-bg 의 media_id>" }],
        "prompt": "Keep the provided reference image exactly as the background without altering its content. Overlay premium Meta ad typography and UI elements on top of it. Typography layout: Large, bold, clean Korean text reading \"당신의 밤을 위한 특별한 사주풀이\". Below it, smaller readable Korean text reading \"매력적인 캐릭터가 직접 들려주는 당신의 운명 이야기\". At the bottom, a clear CTA button or banner with Korean text \"나만의 캐릭터 만나고 무료 사주 보기\". Include a subtle chat-bubble UI element to suggest an interactive experience."
      }
    },
    {
      "index": 3,
      "params": {
        "model": "marketing_studio_image",
        "aspect_ratio": "4:5",
        "count": 1,
        "medias": [{ "role": "image", "value": "<romance-timing-bg 의 media_id>" }],
        "prompt": "Keep the provided reference image exactly as the background without altering its content. Overlay premium Meta ad typography and UI elements on top of it. Typography layout: Large, bold, clean Korean text reading \"우리의 인연이 깊어지는 진짜 타이밍\". Below it, smaller readable Korean text reading \"스쳐 갈 인연인지, 오래 갈 인연인지\". At the bottom, a clear CTA button or banner with Korean text \"무료로 나의 연애 타이밍 확인하기\". Ensure the text is highly readable against the background."
      }
    }
  ]
}
```
