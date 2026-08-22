# 작업 지시서 — 캐릭터 표정 클립 동작 문안

이 문서를 프롬프트를 써 줄 AI 에게 그대로 넘긴다. 답으로 받은 JSON 은
`--import` 로 되돌려 넣으면 검증까지 자동으로 된다.

---

## 함께 보낼 말 (이 칸만 복사해서 문서 앞에 붙인다)

> 아래 지시서대로 캐릭터 표정 클립용 **동작 문안**을 써줘.
>
> - 각 칸에 "무슨 일이 일어나는가" 한두 문장만. 영어로.
> - 캐릭터 id 와 표정 id 는 문서의 명단에서 **글자 그대로** 쓸 것. 새로 만들지 마.
> - 인물 설명, 배경 묘사, 그림체, **카메라 지시**, 초수 지시는 넣지 마. 전부 자동으로 붙어서 중복되면 결과가 나빠져.
> - 3초 안에 시작과 끝이 있는 동작 하나. 여러 사건을 넣지 마.
> - 시선이 어디를 향하는지 반드시 밝혀줘.
> - 답은 **JSON 만**. 설명 문장은 붙이지 마.
>
> 콘텐츠 방향은 문서 맨 아래에 적어뒀어.

### 결과가 규칙을 어겼을 때 다시 보낼 말

> 아래 칸이 규칙을 어겼어. **그 칸만** 고쳐서 JSON 으로 다시 줘.
>
> (여기에 검증 결과 `[!]` 줄을 그대로 붙여넣는다)

---

## 무엇을 만드는가

정지 초상 한 장을 3초짜리 영상으로 움직이게 하는 image-to-video 작업이다.
캐릭터마다 표정별로 클립을 하나씩 만들고, 대화 중 대사의 감정에 맞춰 그 클립이
화면에서 바뀐다.

필요한 것은 **"무슨 일이 일어나는가" 한두 문장**뿐이다.

## 절대 쓰지 말 것

아래는 조립 단계에서 자동으로 붙는다. 답에 포함되면 지시가 중복되어 결과가 나빠진다.

- 인물 설명 (누구인지, 성별, 옷차림, 머리색)
- 배경·소품 묘사
- 그림체·화풍·색감 지시
- **카메라 지시** (줌, 푸시인, 팬, 클로즈업 등) — 카메라는 완전 고정이다
- 길이·초수 지시
- 화질, 워터마크 금지, 텍스트 금지 같은 상투적 꼬리말

## 지켜야 할 것

- 한 칸에 **한두 문장**. 400자를 넘으면 뒤쪽 지시가 묻힌다.
- **영어**로 쓰는 편이 결과가 안정적이다.
- 3초 안에 시작과 끝이 있는 동작 하나. 여러 사건을 넣지 않는다.
- 프레임 밖으로 나가거나 자리를 옮기는 동작은 넣지 않는다 (같은 사람으로 안 보인다).
- 등장인물은 그 캐릭터 한 명뿐이다. 다른 인물을 등장시키지 않는다.
- 시선이 어디를 향하는지 명시하면 결과가 크게 안정된다.

## 캐릭터 명단

| id | 이름 | 성별 | 배경 |
|---|---|---|---|
| `hwarin` | 화린도령 | 남성 | a shrine full of firelight and red drapes |
| `hongryeon` | 홍련신녀 | 여성 | a dark pond shrine lit by lantern light |
| `mukyeon` | 묵연도령 | 남성 | a black shrine under a dark moon |
| `jawol` | 자월신녀 | 여성 | a shrine under a huge violet crescent moon |
| `geumya` | 금야도령 | 남성 | a black shrine hung with golden talismans |
| `maehwa` | 매화아씨 | 여성 | a snow-covered shrine |
| `cheongsa` | 청사도령 | 남성 | a jade-green shrine |
| `bihwa` | 비화신녀 | 여성 | a long indigo-lit shrine |
| `haewol` | 해월도령 | 남성 | a shrine at the water's edge under the moon |
| `yeonhwa` | 연화아씨 | 여성 | a lotus pavilion after rain, under a rose moon |
| `jeokya` | 적야도령 | 남성 | a red-lit shrine full of candles |

## 표정 칸 — 각 칸에 필요한 내용

### `idle` — 평온
아무 일도 일어나지 않는 상태. 숨쉬기·눈 깜빡임처럼 되돌아오는 동작 하나만. 대사 사이에 계속 깔리는 기본 클립이라 여기서 사건이 일어나면 안 된다.

### `shy` — 부끄러움
부끄러움이 얼굴에 드러나고 시선이 카메라에서 떨어지는 흐름. 끝에 한 번 다시 쳐다보면 3초가 꽉 찬다.

### `laugh` — 웃음
참지 못하고 터지는 웃음. 눈·어깨·손 중 최소 둘이 같이 움직여야 진짜로 보인다.

### `tease` — 유혹
카메라를 붙잡는 쪽. 시선의 방향과 거리 변화(가까워지는지)를 반드시 명시할 것. 이 칸이 가장 세게 쓰이는 자리다.

### `disgust` — 극혐
거부가 얼굴과 몸 양쪽에 나오는 흐름. 끝에 시선을 돌려 다시 안 보는 것으로 닫으면 명확하다.

### `sulk` — 삐짐
화가 아니라 삐짐. 대놓고 외면하되 몰래 한 번 곁눈질하는 동작이 있어야 화와 구분된다.

### `surprise` — 놀람
짧고 급한 반응 하나. 놀란 뒤 그대로 굳어 카메라를 보는 것으로 끝내면 다음 대사로 잇기 좋다.

### `sad` — 슬픔
무너지지 않는 슬픔. 눈물이 흐르는지 고이기만 하는지 명시할 것 - 안 정하면 모델이 매번 다르게 만든다.

## 답변 형식

아래 모양의 JSON 만 출력한다. 설명 문장은 붙이지 않는다.
필요한 캐릭터·표정만 넣으면 된다 — 빈 칸은 건너뛴다.

```json
{
  "hongryeon": {
    "tease": "...",
    "shy": "..."
  },
  "jawol": {
    "idle": "..."
  }
}
```

## 콘텐츠 방향

<!-- 원하는 방향을 여기에 직접 적으세요. 이 줄 아래가 그 AI 가 따를 내용 지침이 됩니다. -->
 The large breasts must be clearly exposed, bouncing, and appear alluring. Additionally, as she
  undresses, her cleavage should gradually become visible, covering only the nipples and the parts
  covered by her upper garment. Once her top is removed, her bottom should be taken off, revealing her
  pelvis until black mesh panties are visible. It would also be good to have an animation showing her
  raising her arms, curling her hands in a circular motion, moving them back and forth, and sticking
  out her tongue to suck. Finally, when she is aroused, she should appear genuinely seductive and
  alluring. I would like various sexual scenes to be depicted at a similar level of intensity, and
  make oral sex, masturbation, and other various scenes stimulating and sexy.
