# 광고 카피 세트 v1 — loverabbit-ads

캠페인 `이별정리_전환_v1` / 광고세트 `KR_18+_어드밴티지_v1` 하위 광고 5개.
전부 다이내믹 크리에이티브. 링크는 990원 오퍼 검증 완료분.

가격은 `src/lib/products.ts` 와 대조 확인됨 (사용자 검증, 2026-08-21).

공통 설명: `990원으로 먼저 확인해 보세요.`
공통 행동 유도: 자세히 보기

## 소재 원칙

광고당 **비율이 다른 3종**을 넣는다. 어두운 것 + 화이트 + 1:1.
비율이 섞이는 건 의도한 것이고, Meta 가 배치별로 골라 쓴다.

| 세트 | 폴더 | 규격 |
|---|---|---|
| 어두운 5종 | `marketing/ads/hook-five-v1/` | 가로 1200x628, 세로 1080x1920 |
| 화이트 5종 | `marketing/ads/white-five-v1/` | 피드 1080x1350, 스토리 1080x1920 |
| 스크린샷형 6종 | `marketing/ads/shrine-square-v1/` | 1:1 1080x1080 |
| 성인 후킹 3종 | `marketing/ads/adult-hook-v1/` | 이번 세트에는 미사용 |

---

## 1. 이별

- 광고 이름: `이별_판단기준_이미지_v1`
- 링크: `/saju/breakup-decision`
- 상품: 이별 부검 리포트 (29,900 -> 990)
- 소재 3종
  - `hook-five-v1/05-breakup-ad-horizontal-1200x628.jpg`
  - `white-five-v1/05-breakup-feed-1080x1350.jpg`
  - `shrine-square-v1/01-breakup-square-1080x1080.jpg`

기본 문구
```
붙잡는 게 맞을까, 정리하는 게 맞을까. 결정을 못 하는 게 아니라 기준이 없는 거예요.
두 사람의 사주 흐름으로 판단 기준을 정리해 드려요.
```
제목: `관계의 갈림길, 판단 기준을`

---

## 2. 궁합

- 광고 이름: `궁합_이미지_v1`
- 링크: `/saju/compatibility`
- 상품: 속궁합 사주 (9,900 -> 990)
- 소재 3종
  - `hook-five-v1/01-general-compatibility-ad-horizontal-1200x628.jpg`
  - `white-five-v1/01-compatibility-feed-1080x1350.jpg`
  - `shrine-square-v1/02-compatibility-square-1080x1080.jpg`

기본 문구
```
잘 맞는 것 같다가도 어느 순간 어긋나는 게 반복된다면.
성격 탓만은 아닐 수 있어요. 두 사람의 사주 흐름이 어디서 맞물리고
어디서 엇갈리는지 짚어 드려요.
```
제목: `어디서 맞고 어디서 어긋날까`

---

## 3. 속궁합

- 광고 이름: `속궁합_이미지_v1`
- 링크: `/saju/intimate-compatibility`
- 상품: 속궁합 사주 (9,900 -> 990)
- 소재 3종
  - `hook-five-v1/02-intimate-compatibility-ad-horizontal-1200x628.jpg`
  - `white-five-v1/02-intimate-feed-1080x1350.jpg`
  - `shrine-square-v1/03-intimate-square-1080x1080.jpg`

기본 문구
```
말로 설명이 안 되는 끌림이 있다면.
두 사람의 일주로 끌림의 결이 어떻게 다른지, 어디서 편해지고
어디서 조심해야 하는지 읽어 드려요.
```
제목: `끌림에도 결이 있어요`

---

## 4. 연애운

- 광고 이름: `연애운_이미지_v1`
- 링크: `/product/yeonae` (예전 주소 `/saju/romance-timing` 도 같은 상품을 그대로 판다)
- 상품: 올해의 연애운 (14,900 -> 990) — 인연 타이밍이 2026-08-24 에 여기로 합쳐졌다
- 소재 3종
  - `hook-five-v1/04-romance-fortune-ad-horizontal-1200x628.jpg`
  - `white-five-v1/04-romance-timing-feed-1080x1350.jpg`
  - `shrine-square-v1/04-romance-timing-square-1080x1080.jpg`

기본 문구
```
언제쯤 사람이 들어올까 싶다면.
상대가 아니라 내 흐름부터 봐요. 인연이 붙는 시기와 비켜 가는 시기를
사주 흐름으로 짚어 드려요.
```
제목: `인연이 붙는 시기, 따로 있어요`

> `free-saju-ad` 는 쓰지 않는다. 범용 무료사주 소재라 이 랜딩과 맞지 않는다.
> 이 주제로 만든 것은 `04-romance-fortune` 이다.

---

## 5. 19금

- 광고 이름: `성인궁합_이미지_v1`
- 링크: `/saju/mature-compatibility`
- 상품: 속궁합 사주 (9,900 -> 990)
- 소재 **2종**
  - `white-five-v1/03-mature-feed-1080x1350.jpg`
  - `shrine-square-v1/06-mature-square-1080x1080.jpg`

기본 문구
```
잘 맞는데 어딘가 어긋난다고 느낄 때가 있어요.
두 사람의 사주 흐름으로 서로의 속도와 방식이 어디서 다른지 정리해 드려요.
```
제목: `속도와 방식이 다를 때`

> **어두운 `hook-five-v1/03-mature-night` 는 의도적으로 뺐다.**
> 밀착 장면 위에 밤 카피라 Meta 심의에서 성적 암시로 거부될 위험이 가장 크다.
> 화이트형은 흰 여백이 절반이라 같은 카피여도 그렇게 읽힐 여지가 적고,
> 1:1 은 인물이 한 명뿐이라 더 안전하다.

---

## 이번에 넣지 않는 것

`/saju/inner-mind` (속마음). 990 오퍼는 붙어 있고 검증도 통과했지만
(`inner_mind_990`), 일 예산 ₩25,000 을 다섯이 나눠 쓰는 것이 이미 빠듯하다.
여섯째를 넣으면 학습이 더 느려진다. 초기 승자가 나오면 그때 추가한다.

`marketing/ads/adult-hook-v1/` 3종도 이번 세트에는 쓰지 않는다.

---

## URL 입력 방식

웹사이트 URL 필드에 UTM까지 통째로 넣는다. URL 매개변수 필드는 **비운다**
(넣으면 UTM 이 두 번 붙는다).

```
https://loverebbit.xyz/saju/<slug>?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

`{{campaign.name}}` / `{{ad.name}}` 은 Meta 매크로다. **게시 시점의 이름이 고정**되므로
게시 후 이름을 바꿔도 UTM 값은 따라 바뀌지 않는다. 이름은 게시 전에 확정한다.

---

## 게시 전 필수 확인 3가지

1. **오퍼가 라이브에서 실제로 뜨는지**
   ```
   node scripts/verify-ad-offers.mjs https://loverebbit.xyz
   ```
   36개 체크. 배포 후에 돌린다.

2. **990 결제를 끝까지 한 번** — 반드시 **새 계정**으로.
   기존 계정은 결제 이력이 있어 정가가 뜬다 (유저당 1회 게이트).

3. **Vercel `OPENAI_API_KEY` 유효성.**
   결제는 됐는데 리딩이 안 나오는 것이 최악의 경우다.

---

## 알고 돌리는 것

궁합·속궁합·19금 셋은 **같은 상품**(속궁합 사주)으로 간다. 랜딩 카피와 이미지만 다르다.
같은 유저는 990원 오퍼를 한 번만 살 수 있으므로 셋이 서로 예산을 잠식할 수 있다.
일 예산 ₩25,000 하나를 5개 광고가 나눠 쓰는 구조라 학습이 느려질 수 있다.
사용자가 이를 알고 진행하기로 판단함 (2026-08-21).
