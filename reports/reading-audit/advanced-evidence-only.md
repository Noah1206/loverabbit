# 고급 해석 감사 — 조후·격국·용신

기준 시각 `2026-08-21T03:00:00.000Z` · 기준 명식 1993-01-24 14:00 여 (임신 계축 을사 계미)

생성: `npx tsx scripts/advanced-audit.mts` (모델 호출 없음)

> 이 층은 사용자 글에 아직 한 글자도 나가지 않는다. 그것이 고장이 아니라 설계다.
> 조후·격국·용신은 틀려도 드러나지 않는 층이라, 출처가 확정되기 전에는 계산만 한다.

## 모드별 비교

| 항목 | 기존 P0/P1 | evidence_only | policy_preview | policy_enabled |
| --- | --- | --- | --- | --- |
| 4주·대운·기본 strength | 임신 계축 을사 계미 / 경술(26~35세) / 신약 30 | 같음 | 같음 | not_run |
| 계절/한난조습 | 없음 | 축월 cold/wet | 축월 cold/wet | not_run |
| 격국 후보 | 없음 | determined (편재격/low, 편인격/low, 편관격/low) | determined (편재격/low, 편인격/low, 편관격/low) | not_run |
| 억부 후보 | 없음 (강약 라벨만) | 수(primary) 목(secondary) | 수(primary) 목(secondary) | not_run |
| 조후 후보 | 없음 | 화(primary) 화(secondary) 목(supporting) · 전부 candidate | 화(primary) 화(secondary) 목(supporting) · 승인 0건 | not_run |
| 충돌 상태 | 계산 안 됨 | CONFLICT-EOKBU-JOHU-수화 · policy_resolved | CONFLICT-EOKBU-JOHU-수화 · policy_resolved | not_run |
| 사용자 리포트 결론 변경 | — | 안 바뀜 | 안 바뀜 | not_run |
| blocking/major/advisory | — | blocking 0 · major 1 · advisory 0 | 같음 | not_run |

`policy_enabled` 이 `not_run` 인 것이 정상이다 — 고정 명식 32건 중 32건이 아직 전문가 검토 전이고(advanced-fixtures-v1-computation-2026-08), 그것이 이 모드의 문지기다.

## 기준 명식 상세 (evidence_only)

### 계절 — 계산층이라 출처 없이 확정된다

| 항목 | 값 |
| --- | --- |
| 월지 | 축 |
| 절기 | 소한 이후 18일 |
| 계절 | transition |
| 한난 | cold |
| 조습 | wet |
| 경계 | 아님 |

### 격국

판정 **determined** · 상태 source_attached · 대표 편재격

월령 축 지장간 기(main) 신(middle) 계(residual) → 십성 편재, 편관, 편인

투간 계@월간,시간 · 월지 교란 미충(시지)

| 후보 | 확신 | 근거 |
| --- | --- | --- |
| 편재격 | low | 월지 축의 지장간 기(본기)가 일간 을에게 편재 / 기은 천간에 드러나지 않았다 / 월지가 미충(시지)으로 흔들린다 — 격이 온전하지 않을 수 있다 |
| 편인격 | low | 월지 축의 지장간 계(여기)가 일간 을에게 편인 / 계이 월간,시간에 투간했다 / 월지가 미충(시지)으로 흔들린다 — 격이 온전하지 않을 수 있다 |
| 편관격 | low | 월지 축의 지장간 신(중기)가 일간 을에게 편관 / 신은 천간에 드러나지 않았다 / 월지가 미충(시지)으로 흔들린다 — 격이 온전하지 않을 수 있다 |

- **외격·종격·화기격 제외** — V1에서는 판정하지 않는다. 성립 조건과 학설 차이가 커서, 자동으로 이름을 붙이면 그 한 줄이 리포트 전체의 어조를 정해 버린다. 출처와 기준이 승인된 뒤 V2에서 연다.
- **건록격·양인격 제외** — 월지가 비견·겁재인 경우다. 십성으로 격을 삼지 않는 통례를 따르되, 따로 다루는 유파가 있어 V1에서는 후보를 세우지 않는다.

### 조후 후보

| 오행 | 역할 | 무게 | 상태 | 명식에 있나 | 막고 있는 것 |
| --- | --- | --- | --- | --- | --- |
| 화 | warm | primary | candidate | 있음 | 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 |
| 화 | dry | secondary | candidate | 있음 | 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 |
| 목 | circulate | supporting | candidate | 있음 | 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 |

### 용신 축별 후보

| 축 | 후보 |
| --- | --- |
| 억부 | 수(primary/candidate) 목(secondary/candidate) |
| 조후 | 화(primary/candidate) 화(secondary/candidate) 목(supporting/candidate) |
| 격국 | 미정(primary/blocked) |
| 통관 | 미정(supporting/not_applicable) |
| 병약 | 미정(supporting/not_applicable) |

**합의: conflict** — 억부와 조후가 서로 반대 방향을 가리킨다 (수, 화)

최종: `candidate_only`

### 충돌

- **CONFLICT-EOKBU-JOHU-수화** (major / policy_resolved)
  - 억부는 수, 조후는 화를 가리킨다
  - 억부와 조후가 다른 곳을 가리킨다. CR-BOTH-WITH-SCOPE 에 따라 **고르지 않는다** — 둘 다 남기고 단일 용신 결론을 내지 않는다. 축이 갈린다는 사실 자체가 이 명식의 성질이므로, 한 줄로 좁히면 두 얼굴 중 하나가 사라진다.

### 사용자에게 안 나가는 이유

- ADVANCED_MYEONGRI_MODE=evidence_only — 계산만 하고 사용자 글은 바꾸지 않는다
- 조후 후보 3개가 전부 승인 전이다 (johu-candidates-v1-draft)
- 격국이 determined·source_attached 라 단일 격으로 서술할 수 없다
- 축이 갈린다 (CONFLICT-EOKBU-JOHU-수화) — CR-BOTH-WITH-SCOPE 에 따라 단일 용신 결론을 내지 않는다

프롬프트 입력에 실린 advanced: `null`

## 1. 지금 사용자 리포트에 쓸 수 있는 approved 규칙

| 규칙 | 출처 |
| --- | --- |
| CR-BOTH-WITH-SCOPE |  |

## 2. 계산은 됐지만 아직 쓰면 안 되는 것

| 규칙 | 판정 | 이유 |
| --- | --- | --- |
| ADV-JOHU-COLD-FIRE-V1 | candidate | 언 것은 먼저 녹아야 쓸 수 있다고 보는 조후의 기본 — 나가지 못하는 이유: 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 / 궁통보감의 조후용신론 고찰 — metadata_only 상태라 결론 |
| ADV-JOHU-WET-FIRE-V1 | candidate | 젖은 흙은 말라야 쓸 수 있다고 보는 자리 — 나가지 못하는 이유: 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 / 규칙 상태가 draft 다 |
| ADV-JOHU-COLD-WOOD-V1 | candidate | 불을 살리는 것이 함께 있어야 온기가 유지된다고 보는 자리 — 나가지 못하는 이유: 궁통보감(窮通寶鑑) / 난강망(欄江網) — metadata_only 상태라 결론의 근거가 될 수 없다 / 규칙 상태가 draft 다 |
| ADV-GYEOK-INNER-V1 | candidate | 편재격 후보가 가장 뚜렷하다. 다만 출처가 metadata_only 라 사용자에게 나가지 않는다. |
| ADV-GYEOK-OUTER-UNSUPPORTED-V1 | blocked | 종격·화기격은 일간이 뿌리를 아주 잃었거나 합화가 성립했을 때만 서는데, 그 '아주'의 기준이 유파마다 다르다. 기준을 정하지 않은 채 판정하면 가장 큰 결론이 가장 얇은 근거 위에 서게 된다. |
| ADV-YONGSIN-EOKBU-V1 | candidate | 억부 · 수 · 일간 목이 약하다는 판정(신약 30 제안)에서 나오는 후보 |
| ADV-YONGSIN-EOKBU-V1 | candidate | 억부 · 목 · 비겁이 일간의 힘을 나눠 받쳐 준다고 보는 자리 |
| ADV-JOHU-COLD-FIRE-V1 | candidate | 조후 · 화 · 축월 · cold/wet |
| ADV-JOHU-WET-FIRE-V1 | candidate | 조후 · 화 · 축월 · cold/wet |
| ADV-JOHU-COLD-WOOD-V1 | candidate | 조후 · 목 · 축월 · cold/wet |
| ADV-YONGSIN-GYEOKGUK-V1 | blocked | 격국 · null · 편재격은 섰지만 상신 표(자평진전 판본)가 확보되지 않아 오행을 정할 수 없다 |
| ADV-YONGSIN-TONGGWAN-V2 | blocked | 통관 · null · V2 준비 — 통관 판정 기준이 정해지지 않았다. 리포트에 쓰지 않는다. |
| ADV-YONGSIN-BYEONGYAK-V2 | blocked | 병약 · null · V2 준비 — 병·약 판정의 출처가 정해지지 않았다. 리포트에 쓰지 않는다. |

## 3. 출처·판본·권리·검토가 필요한 빈 칸

| 출처 | 종류 | 판본 | 위치 | 권리 | 결론 근거로 쓸 수 있나 |
| --- | --- | --- | --- | --- | --- |
| SRC-CHUNMISO-IM | classical_text | 임철초 증주본 (판본 미확정) | 권차·편명 미확정 — 판본 확보 후 기재 | metadata_only | **아니오** |
| SRC-GUNGTONG | classical_text | 판본 미확정 | 일간별 월령 편 — 판본 확보 후 기재 | metadata_only | **아니오** |
| SRC-JAPYEONG | classical_text | 판본 미확정 | 논용신·논격국 편 — 판본 확보 후 기재 | metadata_only | **아니오** |
| SRC-YEONHAE | classical_text | 판본 미확정 | 판본 확보 후 기재 | metadata_only | **아니오** |
| SRC-ACADEMIC-2025-YONGSHIN | academic_study | 학술지 논문 | DBpia NODE12434505 | metadata_only | **아니오** |
| SRC-ACADEMIC-2019-JOHU | academic_study | 학술지 논문 | 교보 스콜라 4010070036438 | metadata_only | **아니오** |
| SRC-ACADEMIC-2013-WOLJI | academic_study | 학위논문 | DBpia T13224377 | metadata_only | **아니오** |
| SRC-INTERNAL-CLIMATE | internal_policy | advanced-source-v1-2026-08 | src/lib/myeongri/seasonal-context.ts | internal | **아니오** |

| 충돌 우선순위 정책 | 상태 | 막고 있는 것 |
| --- | --- | --- |
| CR-BOTH-WITH-SCOPE | approved | - |
| CR-JOHU-FIRST-EXTREME-SEASON | draft | SRC-GUNGTONG 이 metadata_only 다. 판본과 위치가 확정되지 않았다. |
| CR-EOKBU-FIRST-DEFAULT | draft | SRC-CHUNMISO-IM 이 metadata_only 다. 그리고 P2 억부 가중치가 아직 policy_proposed 다. |
| CR-GYEOKGUK-FIRST | draft | 상신 표가 없다. 격국 V1은 격의 존재까지만 낸다. |

고정 명식 32건 중 검토 완료 0건, 대기 32건.

## 4. P0/P1 결과와 달라질 수 있는 문장

지금은 **한 문장도 없다.** 아래는 정책이 다 승인됐을 때 달라질 수 있는 자리다.

| 지금 나가는 말 | 승인 뒤 달라질 수 있는 말 | 무엇이 승인돼야 하나 |
| --- | --- | --- |
| 2026년 병오·병신의 화를 상관(마찰)으로만 읽는다 | 겨울 목에게 화는 한기가 풀리는 흐름이기도 하다고 함께 읽는다 | 조후용신 표(SRC-GUNGTONG 판본) + CR-JOHU-FIRST-EXTREME-SEASON |
| 월지 축을 '사회 자리'로만 쓴다 | 월령이 가리키는 구조(격)를 함께 말한다 | 격국 V1 내격 우선순위 + SRC-JAPYEONG 판본 |
| 강약을 신약 36으로 말한다 | 왕상휴수사·설기·통근을 반영한 값으로 말한다 | P2 억부 가중치(strength-v1.json) |

## 고정 명식 회귀 세트

32건. 실제 인물의 명조를 쓰지 않는다 — 생년월일시는 개인정보이고,
유명인 명조는 출처와 정확성이 제각각이다. 계산 경로를 고르게 밟도록 고른 합성 입력이다.

| id | 목적 | 4주 | 계절 | 강약 | 격국 | 합의 | 충돌 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MZ-01-IN | 인월(초봄) — 계절 전환 직후 | 무진 갑인 을사 신사 | 인월 cool/balanced | 신강 | determined | insufficient_evidence | 0 |
| MZ-02-MYO | 묘월(봄) — 목이 왕한 자리 | 신미 신묘 정해 정미 | 묘월 cool/balanced | 중화 | determined | insufficient_evidence | 0 |
| MZ-03-JIN | 진월(습토) — 사계 중 습한 쪽 | 갑술 무진 정축 갑진 | 진월 balanced/wet | 신약 | determined | insufficient_evidence | 0 |
| MZ-04-SA | 사월(초여름) | 병인 계사 계해 임술 | 사월 warm/balanced | 중화 | determined | insufficient_evidence | 0 |
| MZ-05-O | 오월(한여름) — 화가 극에 있는 자리 | 정축 병오 계사 무오 | 오월 hot/dry | 신약 | determined | conflict | 1 |
| MZ-06-MI | 미월(조토) — 덥고 마른 자리 | 계해 기미 신해 병신 | 미월 hot/dry | 중화 | determined | insufficient_evidence | 0 |
| MZ-07-SIN | 신월(초가을) | 경오 갑신 정사 계묘 | 신월 balanced/balanced | 중화 | determined | insufficient_evidence | 0 |
| MZ-08-YU | 유월(가을) — 금이 왕한 자리 | 기미 계유 신묘 정유 | 유월 cool/balanced | 신강 | unsupported | insufficient_evidence | 0 |
| MZ-09-SUL | 술월(조토) — 서늘하고 마른 자리 | 신사 무술 무오 정사 | 술월 cool/dry | 신강 | determined | insufficient_evidence | 0 |
| MZ-10-HAE | 해월(초겨울) | 을묘 정해 경오 계미 | 해월 cold/wet | 신약 | determined | conflict | 1 |
| MZ-11-JA | 자월(한겨울) — 수가 극에 있는 자리 | 기묘 병자 병오 기축 | 자월 cold/wet | 신약 | determined | conflict | 1 |
| MZ-12-CHUK | 축월(겨울 끝) — 기준 명식과 같은 월지 | 임신 계축 을사 계미 | 축월 cold/wet | 신약 | determined | conflict | 1 |
| TB-01-BEFORE-IPCHUN | 입춘 하루 전 — 연주가 갈리는 자리 | 을해 기축 경오 임오 | 축월 cold/wet (경계) | 중화 | determined | insufficient_evidence | 0 |
| TB-02-AFTER-IPCHUN | 입춘 하루 뒤 — 위와 짝 | 병자 경인 임신 병오 | 인월 cool/balanced (경계) | 중화 | determined | insufficient_evidence | 0 |
| TB-03-TERM-EDGE | 절입 당일 — 경계 표시가 서야 한다 | 정묘 정미 기축 무진 | 미월 hot/dry (경계) | 신강 | determined | conflict | 1 |
| TB-04-TERM-DEEP | 절입 한복판 — 경계 표시가 없어야 한다 | 정묘 무신 갑진 무진 | 신월 balanced/balanced | 신약 | determined | insufficient_evidence | 0 |
| HR-01-EARLY-JA | 야자시 — 자시 앞쪽 | 임신 을사 병술 기해 | 사월 warm/balanced | 중화 | ambiguous | insufficient_evidence | 0 |
| HR-02-LATE-JA | 조자시 — 자시 뒤쪽, 날짜가 갈린다 | 임신 을사 병술 무자 | 사월 warm/balanced | 중화 | determined | insufficient_evidence | 0 |
| HR-03-UNKNOWN | 시각 미상 — 시주가 서지 않는다 | 갑자 경오 경진 미상 | 오월 hot/dry | 신약 | determined | conflict | 1 |
| ST-01-STRONG | 일간이 뿌리를 많이 둔 명식 | 경신 무인 정축 임인 | 인월 cool/balanced (경계) | 중화 | determined | insufficient_evidence | 0 |
| ST-02-WEAK | 일간이 계절을 거스르고 설기가 많은 명식 | 을해 임오 을미 임오 | 오월 hot/dry | 중화 | determined | insufficient_evidence | 0 |
| ST-03-EVEN | 중화에 가까운 명식 | 기사 무진 임인 무신 | 진월 balanced/wet | 신약 | determined | insufficient_evidence | 0 |
| GK-01-EXPOSED-MAIN | 월지 본기가 투간 — 격이 뚜렷할 후보 | 정사 경술 기해 정묘 | 술월 cool/dry (경계) | 신강 | determined | insufficient_evidence | 0 |
| GK-02-NO-EXPOSURE | 월지 지장간이 하나도 투간하지 않음 | 계미 계해 경술 정해 | 해월 cold/wet | 신약 | determined | conflict | 1 |
| GK-03-MONTH-CLASHED | 월지가 충을 맞음 — 격이 흔들리는 자리 | 임술 기유 경자 무인 | 유월 cool/balanced | 신강 | unsupported | insufficient_evidence | 0 |
| GK-04-MONTH-COMBINED | 월지가 육합에 묶임 | 무인 계해 무인 신유 | 해월 cold/wet | 신약 | determined | unanimous | 0 |
| GK-05-BIGYEOP-MONTH | 월지가 비겁 — 내격 후보가 안 서는 자리 | 계유 을묘 경술 병술 | 묘월 cool/balanced | 중화 | determined | insufficient_evidence | 0 |
| CF-01-WINTER-WEAK | 겨울생 신약 — 조후와 억부가 갈릴 후보 | 기묘 정축 을축 정축 | 축월 cold/wet (경계) | 신약 | determined | conflict | 1 |
| CF-02-SUMMER-WEAK | 여름생 신약 — 위의 반대쪽 | 을축 계미 임자 정미 | 미월 hot/dry | 신약 | determined | conflict | 1 |
| CF-03-WINTER-STRONG | 겨울생 신강 — 조후와 억부가 같은 쪽을 볼 후보 | 무오 갑자 갑자 갑자 | 자월 cold/wet | 신강 | determined | unanimous | 0 |
| CF-04-SUMMER-STRONG | 여름생 신강 | 갑신 경오 병진 계사 | 오월 hot/dry (경계) | 신강 | ambiguous | conflict | 1 |
| PT-01-PARTNER | 기준 명식의 상대 — 궁합 경로 회귀 | 신미 을미 기묘 갑술 | 미월 hot/dry (경계) | 신강 | determined | conflict | 1 |

격국 판정: determined 28 / ambiguous 2 / unsupported 2

축 합의: insufficient_evidence 19 · conflict 11 · unanimous 2

`expectedGyeokgukStatus` 와 `approvedPolicyAssertions` 는 아직 채우지 않았다. 그 칸을
그럴듯하게 채우면 회귀 테스트가 **틀린 답을 지키는 장치**가 된다. 전문가 검토 뒤에 채운다.

## 승인 순서

| # | 승인할 것 | 왜 이 순서인가 | 상태 |
| --- | --- | --- | --- |
| 1 | 조후의 기후 계산 범위 | 절기·월지·한난조습은 후보 결론보다 먼저 검증 가능한 사실층이다 | 완료 |
| 2 | 격국 V1 내격 우선순위 | 월령 투간 우선. 32건 중 모호가 16건 -> 2건으로 줄었다. 격 이름을 부르는 것은 아직 별개다 | 완료 |
| 3 | 억부 강약 정책 | P2의 가중치·통근·설기·인성과다 기준을 명시적으로 정해야 한다 | 완료 |
| 4 | 조후용신 표 (일간 × 월지 120칸) | 판본·번역·주석과 각 행의 근거를 확보한 뒤에만 승인할 수 있다 | 대기 |
| 5 | 격국·조후·억부 충돌 우선순위 | 단일 용신 결론을 사용자에게 보여 주기 직전의 마지막 정책이다 | 완료 |
| 6 | 통관·병약·외격·종격 | 학설 차이와 예외가 커서 V2 이후로 미룬다 | 대기 |

관리 화면: `/admin/myeongri-policy`

