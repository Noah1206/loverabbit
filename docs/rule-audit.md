# 해석 규칙 감사 — 57건

> **이 문서는 명리 전문가 검수용입니다.**
> 아래 감사는 *내부 정합성·도달성·커버리지*를 본 것이고,
> **"이 해석이 명리적으로 옳은가"는 판정하지 않았습니다.**
> 각 규칙의 `근거`에 어떤 원리에 기댔는지 적어뒀으니, 그 부분을 봐주시면 됩니다.

작성 2026-08-20 · 대상 `src/lib/reading-rules.ts`

---

## 이번 감사에서 고친 것

| 문제 | 조치 |
|---|---|
| **15개 상품이 같은 규칙을 받음** — `domains` 조건을 가진 규칙이 0건이라 상품 필터가 아무 일도 안 함 | 28건에 상품 태그를 배정. 같은 명식으로 15개 상품을 돌리면 **13가지 서로 다른 집합** |
| **중화 명식 25%가 오행 성정을 못 받음** — `SELF-*` 가 신약/신강에만 걸려 있어 중화는 `SELF-BALANCED` 하나뿐 | 오행별 중화 규칙 5건 추가(`SELF-*-EVEN`). 792개 중화 명식에서 공백 **0** |
| **화개가 66% 발화** — 삼합의 고지(진술축미)가 넉 자 중 하나만 걸려도 잡혀, 그 사람을 구별하지 못함 | 우선순위 76 → 46. 다른 규칙이 적을 때만 뽑히게 |
| 평생·연애기질 상품이 규칙 3개 이하를 19.5% / 12.7% 받음 | 기질 규칙 24건에 두 상품을 추가. 최악 **3.5%**로 |

## 확인했고 문제 없던 것

- **죽은 규칙 0건** — 명식 3,000개에서 모든 규칙이 최소 1회 발화
- **규칙이 0개 켜지는 명식 0건**
- **성별 비대칭** — 여자는 관성, 남자는 재성이 배우자성. `SPOUSE-STAR-*` 와 `LUCK-GWAN/JAE-*` 에서 일관
- **모순 쌍** — 동시 발화 쌍을 낱말 기준으로 훑어 28쌍이 걸렸으나, 읽어보니 전부 서로 다른 축
  (감정 속도 / 관계 형식 / 매력의 종류)이라 논리적 모순은 없었습니다. 이 검사는 낱말 기반이라 과검출합니다

---

## 규칙 표

- **발화율** — 무작위 명식 3,000개 기준. 상품 필터를 끄고 잰 값입니다
- **상품** — 비어 있으면(전체) 모든 상품에서 켜지는 기본 뼈대입니다

### 일간 오행 × 강약 (`SELF-*`) — 16건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `SELF-FIRE-WEAK` | 80 | 10.3% | dayMasterElement=화 · strength=신약 | 전체 |
| `SELF-FIRE-STRONG` | 78 | 5.2% | dayMasterElement=화 · strength=신강 | 전체 |
| `SELF-WATER-WEAK` | 80 | 10.7% | dayMasterElement=수 · strength=신약 | 전체 |
| `SELF-WATER-STRONG` | 78 | 4.8% | dayMasterElement=수 · strength=신강 | 전체 |
| `SELF-WOOD-WEAK` | 80 | 9.0% | dayMasterElement=목 · strength=신약 | 전체 |
| `SELF-WOOD-STRONG` | 78 | 4.5% | dayMasterElement=목 · strength=신강 | 전체 |
| `SELF-METAL-WEAK` | 80 | 6.1% | dayMasterElement=금 · strength=신약 | 전체 |
| `SELF-METAL-STRONG` | 78 | 8.5% | dayMasterElement=금 · strength=신강 | 전체 |
| `SELF-EARTH-WEAK` | 80 | 6.6% | dayMasterElement=토 · strength=신약 | 전체 |
| `SELF-EARTH-STRONG` | 78 | 8.2% | dayMasterElement=토 · strength=신강 | 전체 |
| `SELF-FIRE-EVEN` | 62 | 4.9% | dayMasterElement=화 · strength=중화 | 전체 |
| `SELF-WATER-EVEN` | 62 | 5.0% | dayMasterElement=수 · strength=중화 | 전체 |
| `SELF-WOOD-EVEN` | 62 | 5.0% | dayMasterElement=목 · strength=중화 | 전체 |
| `SELF-METAL-EVEN` | 62 | 5.7% | dayMasterElement=금 · strength=중화 | 전체 |
| `SELF-EARTH-EVEN` | 62 | 5.5% | dayMasterElement=토 · strength=중화 | 전체 |
| `SELF-BALANCED` | 54 | 26.1% | strength=중화 | 전체 |

<details><summary>주장과 근거</summary>

**`SELF-FIRE-WEAK`**
- 주장: 마음이 붙는 속도는 빠른데 그 열을 혼자 오래 유지하지 못해, 상대의 반응에 따라 온도가 크게 오르내리는 구조
- 근거: 오행 성정 — 火는 확산·표현. 신약한 火는 스스로 불씨를 지키지 못하고 인성(木)의 도움에 좌우된다.

**`SELF-FIRE-STRONG`**
- 주장: 감정을 크게 쓰고 표현도 앞서 나가, 상대가 따라오기 전에 혼자 먼저 달아오르는 편
- 근거: 오행 성정 — 火 신강은 열이 과해 설기(土)나 극(水) 없이는 스스로 태운다.

**`SELF-WATER-WEAK`**
- 주장: 상대의 기분을 먼저 읽느라 자기 요구를 뒤로 미루고, 그 미룬 것이 뒤늦게 서운함으로 남는 경향
- 근거: 오행 성정 — 水는 智·감지. 신약하면 감지력은 남고 자기 흐름을 낼 힘이 부족하다.

**`SELF-WATER-STRONG`**
- 주장: 속을 여러 겹으로 두고 필요한 만큼만 내보여, 가까운 사이에서도 마지막 한 겹을 남기는 편
- 근거: 오행 성정 — 水는 깊고 감춘다. 신강하면 그 깊이가 두꺼워진다.

**`SELF-WOOD-WEAK`**
- 주장: 시작하는 마음은 곧게 서는데 밀고 갈 뿌리가 얕아, 관계도 초반을 지나면 힘이 빠지기 쉬운 구조
- 근거: 오행 성정 — 木은 시작·성장. 신약한 木은 뻗다 멈춘다.

**`SELF-WOOD-STRONG`**
- 주장: 관계에서도 방향과 명분을 먼저 세우고, 그 방향이 흔들리면 관계 자체를 다시 보는 편
- 근거: 오행 성정 — 木은 仁·곧음. 신강하면 굽히지 않는다.

**`SELF-METAL-WEAK`**
- 주장: 기준은 안에서 분명한데 그 기준을 말로 세우지 못해 혼자 삼키고 판정만 쌓는 경향
- 근거: 오행 성정 — 金은 義·결단. 신약하면 판단은 서되 끊어낼 힘이 부족하다.

**`SELF-METAL-STRONG`**
- 주장: 선이 분명하고 그 선을 넘는 상대에게는 설명보다 정리가 먼저 나가는 편
- 근거: 오행 성정 — 金 신강은 수렴·절제가 과해 단호함으로 나타난다.

**`SELF-EARTH-WEAK`**
- 주장: 품으려는 마음이 앞서 상대의 자리를 넓혀주다 자기 자리를 좁히는 경향
- 근거: 오행 성정 — 土는 信·포용. 신약하면 중심이 얇아 맞춰주는 쪽으로 기운다.

**`SELF-EARTH-STRONG`**
- 주장: 속도를 늦추고 오래 지켜본 뒤에야 움직여, 상대에게는 뜸을 들이는 것처럼 보이기 쉬운 편
- 근거: 오행 성정 — 土 신강은 무겁고 느리다.

**`SELF-FIRE-EVEN`**
- 주장: 달아오르는 힘과 식히는 힘이 함께 있어, 감정을 크게 내되 스스로 거둬들일 줄도 아는 편
- 근거: 오행 성정 + 강약 — 火가 중화면 확산과 수렴이 같이 선다. 火의 표현력은 남되 자기 소진이 덜하다.

**`SELF-WATER-EVEN`**
- 주장: 상대를 읽는 눈과 자기 흐름을 낼 힘이 함께 있어, 맞춰주면서도 필요한 말은 하는 편
- 근거: 오행 성정 + 강약 — 水가 중화면 감지력(智)은 남고 자기 물길을 낼 힘도 선다.

**`SELF-WOOD-EVEN`**
- 주장: 시작하는 힘과 밀고 갈 뿌리가 함께 있어, 벌인 일을 끝까지 가져가는 편
- 근거: 오행 성정 + 강약 — 木이 중화면 시작(生)과 지속(根)이 같이 선다.

**`SELF-METAL-EVEN`**
- 주장: 선을 그을 줄 알면서 그 선을 상대에게 설명할 여유도 있어, 단호함이 차갑게만 남지 않는 편
- 근거: 오행 성정 + 강약 — 金이 중화면 결단(義)이 서되 과하게 자르지 않는다.

**`SELF-EARTH-EVEN`**
- 주장: 품는 힘과 밀어낼 힘이 함께 있어, 받아주되 감당 못 할 것은 미리 접는 편
- 근거: 오행 성정 + 강약 — 土가 중화면 포용(信)이 서되 무한정 받아 안지 않는다.

**`SELF-BALANCED`**
- 주장: 한쪽으로 크게 기울지 않아 상황에 맞춰 태도를 바꿀 수 있고, 그만큼 자기 색이 늦게 드러나는 구조
- 근거: 강약 — 중화는 특정 오행에 휘둘리지 않으나 뚜렷한 축도 약하다.

</details>

### 오행 결핍 (`MISS-*`) — 5건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `MISS-FIRE` | 72 | 20.9% | missingElement=화 | 전체 |
| `MISS-WATER` | 72 | 21.2% | missingElement=수 | 전체 |
| `MISS-WOOD` | 70 | 22.8% | missingElement=목 | 전체 |
| `MISS-METAL` | 70 | 22.4% | missingElement=금 | 전체 |
| `MISS-EARTH` | 70 | 8.2% | missingElement=토 | 전체 |

<details><summary>주장과 근거</summary>

**`MISS-FIRE`**
- 주장: 확신을 데워주는 기운이 비어 있어 머리로 답을 알아도 발이 늦게 떨어지는 구조
- 근거: 오행 결자 — 火 부재는 추진·표현의 열이 부족한 것으로 본다.

**`MISS-WATER`**
- 주장: 흘려보내는 기운이 없어 한 번 걸린 감정을 오래 쥐고, 같은 장면을 반복해 되감는 편
- 근거: 오행 결자 — 水 부재는 융통·해소가 약한 것으로 본다.

**`MISS-WOOD`**
- 주장: 먼저 뻗어나가는 기운이 얇아 관계를 여는 쪽보다 응하는 쪽에 서기 쉬운 구조
- 근거: 오행 결자 — 木 부재는 시작·확장의 힘이 약한 것으로 본다.

**`MISS-METAL`**
- 주장: 끊어내는 기운이 얇아 정리해야 할 관계를 필요 이상으로 길게 끄는 편
- 근거: 오행 결자 — 金 부재는 결단·절단이 약한 것으로 본다.

**`MISS-EARTH`**
- 주장: 관계를 눌러 담아둘 바닥이 얇아 상황이 바뀔 때 마음도 함께 흔들리는 구조
- 근거: 오행 결자 — 土 부재는 안정·중재의 바탕이 약한 것으로 본다.

</details>

### 십성 (`TG-*`) — 10건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `TG-JEONGGWAN` | 76 | 25.8% | tenGodAny=정관 | 전체 |
| `TG-PYEONGWAN` | 76 | 23.5% | tenGodAny=편관 | 전체 |
| `TG-JEONGJAE` | 74 | 16.5% | tenGodAny=정재 | 전체 |
| `TG-PYEONJAE` | 74 | 0.0% | tenGodAny=편재 | baramgi dohwasal hwanseung pyeongsaeng bamgijil sseom |
| `TG-SIKSIN` | 72 | 40.0% | tenGodAny=식신 | 전체 |
| `TG-SANGGWAN` | 74 | 0.0% | tenGodAny=상관 | baramgi ibyeol dohwasal gwontaegi pyeongsaeng bamgijil sseom jjak |
| `TG-JEONGIN` | 72 | 20.5% | tenGodAny=정인 | 전체 |
| `TG-PYEONIN` | 70 | 21.2% | tenGodAny=편인 | 전체 |
| `TG-BIGYEON` | 66 | 51.5% | tenGodAny=비견 | 전체 |
| `TG-GEOPJAE` | 72 | 0.0% | tenGodAny=겁재 | hwanseung baramgi ibyeol pyeongsaeng bamgijil sseom jjak |

<details><summary>주장과 근거</summary>

**`TG-JEONGGWAN`**
- 주장: 관계를 형태와 약속으로 지키려 하고, 형태가 흐릿한 상태를 오래 못 견디는 성향
- 근거: 십성 — 정관은 나를 정당하게 극하는 자리. 규범·책임·명예.

**`TG-PYEONGWAN`**
- 주장: 긴장이 있는 관계에서 몰입이 커지고, 편안하기만 한 관계에서는 오히려 마음이 식는 경향
- 근거: 십성 — 편관(칠살)은 나를 강하게 극하는 자리. 압박·자극.

**`TG-JEONGJAE`**
- 주장: 현실 조건과 지속 가능성을 먼저 계산하고, 계산이 서야 마음을 마저 내는 편
- 근거: 십성 — 정재는 내가 정당하게 극하는 자리. 안정·성실.

**`TG-PYEONJAE`**
- 주장: 인연의 폭이 넓게 열려 여러 갈래가 동시에 들어오고, 그만큼 한곳에 고이지 않는 구조
- 근거: 십성 — 편재는 유동적으로 취하는 자리. 넓은 인연·유통.

**`TG-SIKSIN`**
- 주장: 표현으로 마음을 풀어내며 관계를 데우고, 말이 막히면 관계도 함께 막히는 편
- 근거: 십성 — 식신은 내가 생하는 자리. 표현·여유·베풂.

**`TG-SANGGWAN`**
- 주장: 정해진 틀을 답답해하고 관계의 규칙을 다시 짜려 해, 상대에게는 반박처럼 들리기 쉬운 경향
- 근거: 십성 — 상관은 정관을 극한다. 재능·비판·틀 거부.

**`TG-JEONGIN`**
- 주장: 보살핌으로 애정을 확인하고, 받는 자리에 있을 때 관계가 안정되는 편
- 근거: 십성 — 정인은 나를 정당하게 생하는 자리. 보호·수용.

**`TG-PYEONIN`**
- 주장: 혼자 정리하는 시간을 확보해야 관계로 돌아올 수 있고, 그 시간이 상대에게는 거리로 읽히는 구조
- 근거: 십성 — 편인은 편중된 생. 직관·고독·내향.

**`TG-BIGYEON`**
- 주장: 대등함이 지켜질 때 관계가 오래 가고, 한쪽이 기울면 애정보다 자존이 먼저 반응하는 편
- 근거: 십성 — 비견은 같은 오행 같은 음양. 대등·자립.

**`TG-GEOPJAE`**
- 주장: 비교와 경쟁이 개입할 때 관계의 온도가 흔들리고, 가진 것을 나눠야 하는 자리에서 특히 예민해지는 구조
- 근거: 십성 — 겁재는 재를 나눈다(奪財). 경쟁·분할.

</details>

### 배우자궁 (`SPOUSE-*`) — 3건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `SPOUSE-STAR-F` | 86 | 0.0% | gender=F · dayBranchTenGod=정관/편관 | gyeolhon jaehoe insun pyeongsaeng |
| `SPOUSE-STAR-M` | 86 | 0.0% | gender=M · dayBranchTenGod=정재/편재 | gyeolhon jaehoe insun pyeongsaeng |
| `SPOUSE-PALACE-CHUNG` | 88 | 0.0% | dayBranchClashed=true | gyeolhon ibyeol gwontaegi jaehoe pyeongsaeng bamgijil |

<details><summary>주장과 근거</summary>

**`SPOUSE-STAR-F`**
- 주장: 배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조
- 근거: 궁위 — 일지는 배우자궁. 여자 사주에서 관성이 배우자성.

**`SPOUSE-STAR-M`**
- 주장: 배우자 자리에 배우자를 뜻하는 글자가 앉아, 관계가 삶의 중심으로 들어오기 쉬운 구조
- 근거: 궁위 — 일지는 배우자궁. 남자 사주에서 재성이 배우자성.

**`SPOUSE-PALACE-CHUNG`**
- 주장: 배우자 자리가 충을 맞아, 가까운 사이일수록 같은 지점에서 크게 부딪히는 구조
- 근거: 궁위 — 일지 충은 배우자궁이 흔들리는 것으로 본다.

</details>

### 신살 (`SIN-*`) — 6건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `SIN-DOHWA` | 84 | 0.0% | shinsal=도화 | dohwasal baramgi sokgunghap sseom yeonae pyeongsaeng bamgijil |
| `SIN-HONGYEOM` | 82 | 0.0% | shinsal=홍염 | dohwasal baramgi sokgunghap jjak sseom pyeongsaeng bamgijil |
| `SIN-YEOKMA` | 78 | 0.0% | shinsal=역마 | insun hwanseung yeonae pyeongsaeng bamgijil |
| `SIN-HWAGAE` | 46 | 0.0% | shinsal=화개 | bimil gwontaegi bamgijil pyeongsaeng |
| `SIN-YANGIN` | 78 | 0.0% | shinsal=양인 | baramgi ibyeol gwontaegi pyeongsaeng bamgijil |
| `SIN-WONJIN` | 80 | 0.0% | shinsal=원진 | ibyeol gwontaegi jaehoe hwanseung pyeongsaeng bamgijil |

<details><summary>주장과 근거</summary>

**`SIN-DOHWA`**
- 주장: 사람을 끌어당기는 기운이 명식에 앉아, 의도하지 않아도 눈길이 모이는 자리
- 근거: 신살 — 도화(년살)는 삼합 생지의 다음 글자. 매력·인기로 본다.

**`SIN-HONGYEOM`**
- 주장: 첫인상보다 오래 볼수록 번지는 색이 있어, 시간이 지나며 끌림이 커지는 결
- 근거: 신살 — 홍염살은 일간 기준. 도화가 드러난 매력이면 홍염은 은근한 매력으로 구분한다.

**`SIN-YEOKMA`**
- 주장: 자리와 환경이 바뀔 때 인연도 함께 움직여, 관계의 전환점이 이동과 겹치는 구조
- 근거: 신살 — 역마는 삼합 생지의 충. 이동·변동으로 본다.

**`SIN-HWAGAE`**
- 주장: 혼자 있는 시간에 기운이 정리되는 편이라, 붙어 있는 시간만으로는 애정이 채워지지 않는 구조
- 근거: 신살 — 화개는 삼합의 고지. 고독·예술·수렴으로 본다.

**`SIN-YANGIN`**
- 주장: 밀어붙이는 힘이 강해 결정적인 순간에 관계를 단번에 밀거나 단번에 끊는 경향
- 근거: 신살 — 양인은 양간의 겁재 자리. 극왕(極旺)의 칼로 본다.

**`SIN-WONJIN`**
- 주장: 이유를 대기 어려운 거슬림이 관계 안에 깔려, 사건 없이도 마음이 멀어지는 구조
- 근거: 신살 — 원진은 지지의 미워하되 이유를 모르는 조합(자미·축오·인유·묘신·진해·사술).

</details>

### 한 명식 안의 형충회합 (`REL-*`) — 4건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `REL-CHUNG` | 80 | 0.0% | relationKind=지지충 | ibyeol gwontaegi jaehoe pyeongsaeng bamgijil bimil |
| `REL-YUKHAP` | 76 | 0.0% | relationKind=지지육합 | sokgunghap gyeolhon insun pyeongsaeng bamgijil jjak sseom |
| `REL-SAMHAP` | 74 | 0.0% | relationKind=삼합 | sokgunghap gyeolhon insun pyeongsaeng bamgijil jjak sseom |
| `REL-CHEONHAP` | 72 | 0.0% | relationKind=천간합 | sokgunghap jjak bimil pyeongsaeng bamgijil sseom |

<details><summary>주장과 근거</summary>

**`REL-CHUNG`**
- 주장: 명식 안에 정면으로 부딪히는 자리가 있어, 같은 지점에서 반복해 걸려 넘어지는 구조
- 근거: 형충회합 — 지지충은 마주 보는 두 지지가 서로를 친다.

**`REL-YUKHAP`**
- 주장: 붙잡아두는 힘이 있어 한 번 맺은 관계를 길게 유지하고, 정리해야 할 때도 늦어지는 편
- 근거: 형충회합 — 육합은 두 지지가 묶여 서로를 붙든다.

**`REL-SAMHAP`**
- 주장: 세 글자가 한 방향으로 모여 그 축의 일이 크게 벌어지고, 다른 축은 상대적으로 얇아지는 구조
- 근거: 형충회합 — 삼합은 생지·왕지·고지가 모여 한 국(局)을 이룬다.

**`REL-CHEONHAP`**
- 주장: 천간이 서로 묶여 본래의 성정이 그대로 나오지 못하는 자리가 있어, 상대에 따라 다른 사람처럼 보이는 구조
- 근거: 형충회합 — 천간합은 합화(合化)하거나 기반(羈絆)되어 본래 작용이 묶인다.

</details>

### 대운·세운 십성 (`LUCK-*`) — 7건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `LUCK-GWAN-F` | 90 | 0.0% | gender=F · luckTenGodAny=정관/편관 | jaehoe gyeolhon insun yeonae pyeongsaeng bamgijil |
| `LUCK-GWAN-M` | 84 | 0.0% | gender=M · luckTenGodAny=정관/편관 | jaehoe gyeolhon insun yeonae pyeongsaeng bamgijil |
| `LUCK-JAE-M` | 90 | 0.0% | gender=M · luckTenGodAny=정재/편재 | jaehoe gyeolhon insun yeonae pyeongsaeng bamgijil |
| `LUCK-JAE-F` | 84 | 0.0% | gender=F · luckTenGodAny=정재/편재 | jaehoe gyeolhon insun yeonae pyeongsaeng bamgijil |
| `LUCK-IN` | 82 | 0.0% | luckTenGodAny=정인/편인 | insun yeonae gwontaegi pyeongsaeng bamgijil jjak bimil |
| `LUCK-SIKSANG` | 82 | 0.0% | luckTenGodAny=식신/상관 | insun yeonae sseom dohwasal pyeongsaeng bamgijil jjak bimil |
| `LUCK-BIGEOP` | 84 | 0.0% | luckTenGodAny=비견/겁재 | hwanseung baramgi ibyeol yeonae pyeongsaeng bamgijil |

<details><summary>주장과 근거</summary>

**`LUCK-GWAN-F`**
- 주장: 지금 구간은 배우자성이 들어와 인연과 관계의 형태가 표면으로 올라오는 흐름
- 근거: 운 — 여자 사주에서 관성은 배우자성. 관성운에 관계 사안이 부각된다.

**`LUCK-GWAN-M`**
- 주장: 지금 구간은 책임과 평가가 커져, 관계보다 자기 위치를 지키는 쪽으로 힘이 쏠리는 흐름
- 근거: 운 — 남자 사주에서 관성은 직위·책임. 배우자성이 아니다.

**`LUCK-JAE-M`**
- 주장: 지금 구간은 배우자성이 들어와 만남의 기회가 늘고 선택지가 벌어지는 흐름
- 근거: 운 — 남자 사주에서 재성은 배우자성. 재성운에 인연 사안이 부각된다.

**`LUCK-JAE-F`**
- 주장: 지금 구간은 바깥일과 활동이 늘어, 관계에 쓸 여력이 줄고 우선순위가 밀리기 쉬운 흐름
- 근거: 운 — 여자 사주에서 재성은 활동·재물. 배우자성이 아니다.

**`LUCK-IN`**
- 주장: 지금 구간은 밖으로 벌이기보다 안으로 정리하는 쪽에 힘이 실려, 관계도 확장보다 점검에 맞는 흐름
- 근거: 운 — 인성운은 수용·학습·휴식. 확장보다 축적의 구간으로 본다.

**`LUCK-SIKSANG`**
- 주장: 지금 구간은 말과 표현이 관계를 크게 움직여, 한 마디가 평소보다 멀리 가는 흐름
- 근거: 운 — 식상운은 내보내는 기운. 표현이 커진다.

**`LUCK-BIGEOP`**
- 주장: 지금 구간은 사람이 끼어들며 관계의 지분이 흔들리기 쉬워, 둘 사이의 일이 셋의 일이 되는 흐름
- 근거: 운 — 비겁운은 나눔·경쟁. 재(財)를 나누는 자리로 본다.

</details>

### 두 명식 대조 (`PAIR-*`) — 5건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `PAIR-YUKHAP` | 92 | 0.0% | needsPartner=true · pairRelation=일지육합 | sokgunghap gyeolhon jjak sseom jaehoe bimil |
| `PAIR-SAMHAP` | 90 | 0.0% | needsPartner=true · pairRelation=일지삼합 | sokgunghap gyeolhon jjak sseom jaehoe bimil |
| `PAIR-CHUNG` | 92 | 0.0% | needsPartner=true · pairRelation=일지충 | sokgunghap ibyeol gwontaegi jaehoe hwanseung jjak sseom |
| `PAIR-WONJIN` | 88 | 0.0% | needsPartner=true · pairRelation=일지원진 | ibyeol gwontaegi hwanseung baramgi |
| `PAIR-GANHAP` | 88 | 0.0% | needsPartner=true · pairRelation=일간합 | sokgunghap gyeolhon jjak bimil jaehoe |

<details><summary>주장과 근거</summary>

**`PAIR-YUKHAP`**
- 주장: 두 사람의 배우자 자리가 서로를 붙잡는 조합이라, 떨어져도 다시 당겨지는 구조
- 근거: 궁합 — 일지 육합은 배우자궁끼리 묶이는 조합.

**`PAIR-SAMHAP`**
- 주장: 두 배우자 자리가 같은 국에 들어 방향이 같은 쪽으로 모이는 구조
- 근거: 궁합 — 일지가 같은 삼합국에 속하면 지향이 겹친다.

**`PAIR-CHUNG`**
- 주장: 두 사람의 배우자 자리가 정면으로 부딪히는 조합이라, 가까워질수록 같은 지점에서 크게 갈리는 구조
- 근거: 궁합 — 일지 충은 배우자궁끼리 마주쳐 부딪히는 조합.

**`PAIR-WONJIN`**
- 주장: 설명하기 어려운 거슬림이 두 사람 사이에 깔려, 다툴 일이 없는데도 마음이 식는 구간이 생기는 구조
- 근거: 궁합 — 일지 원진은 이유 없는 거슬림으로 본다.

**`PAIR-GANHAP`**
- 주장: 두 일간이 묶이는 조합이라 서로 앞에서만 태도가 달라지고, 제3자가 보는 모습과 차이가 나는 구조
- 근거: 궁합 — 일간 천간합은 두 사람이 서로에게 기반(羈絆)되는 조합.

</details>

### 계산 한계 (`META-*`) — 1건

| ID | 우선 | 발화율 | 조건 | 상품 |
|---|---|---|---|---|
| `META-NO-HOUR` | 96 | 14.8% | hourUnknown=true | 전체 |

<details><summary>주장과 근거</summary>

**`META-NO-HOUR`**
- 주장: 출생 시각이 없어 시주가 서지 않으므로, 시주에 기댄 해석은 범위를 넓게 잡아야 함
- 근거: 계산 한계 — 시주 미상. saju_facts.fourPillars.hour가 null이다.

</details>

---

## 전문가께 먼저 봐주십사 하는 것

1. **오행별 중화 규칙 5건**(`SELF-*-EVEN`) — 이번에 새로 쓴 것이라 아직 아무 검토도 받지 않았습니다
2. **`domains` 배정** — 어떤 규칙이 어떤 상품에 속하는지는 명리 지식과 상품 기획이 만나는 지점입니다.
   위 표의 '상품' 열이 그 배정이고, 바꾸기 쉽게 한 곳에 모여 있습니다
3. **화개 우선순위 강등** — 66% 발화가 명리적으로 정상인지, 아니면 계산이 과하게 잡는 것인지
   (`saju-shinsal.ts` 가 연지와 일지 두 기준에서 뽑습니다)
4. **금지 문구**(`forbidden`) — 각 규칙이 못 하게 막은 말이 충분한지
