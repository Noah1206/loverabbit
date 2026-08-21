# 사주시바 코퍼스 검증

- 코퍼스: `src/content/reference/sajushiba/corpus.v1.jsonl`
- 패턴 라이브러리: `src/content/reference/sajushiba/pattern-library.v1.json`
- 파싱된 행: **11개**
- 패턴: **8개**
- 판정: **통과** (blocking 0건, advisory 1건)

## 접근 범위

| post_id | 상태 | source_method | permission_scope | 자수 |
|---|---|---|---|---:|
| SS-20260703-WEEKLY-TOP5 | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 197 |
| SS-20260716-FREE-READING | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 822 |
| SS-20260722-DAILY-12-ZODIAC | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 1206 |
| SS-20260722-COLOR-WARNING | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 989 |
| SS-20260725-APP-LAUNCH | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 526 |
| SS-20260730-DAILY-RANKING | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 1905 |
| SS-20260731-WEEKLY-LOVE-TOP5 | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 439 |
| SS-20260731-WEEKLY-LOVE-REPLIES | partial_parent_unavailable | public_threads_extraction | user_asserted_style_and_copy_reuse | 320 |
| SS-20260802-GOAT-INNER-WORLD | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 350 |
| SS-20260805-HIDDEN-PAIN | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 716 |
| SS-20260807-HIDDEN-MIND | complete | public_threads_extraction | user_asserted_style_and_copy_reuse | 767 |

## 검증 결과

| 등급 | 위치 | 내용 |
|---|---|---|
| advisory | SS-20260731-WEEKLY-LOVE-REPLIES | 부모 글이 없어 문맥이 잘려 있다 — 원문 직접 재사용 대상에서 뺀다 |

## 패턴 → 원문 참조

| pattern | funnel | source_post_ids | 레인 |
|---|---|---|---|
| SS-P01-WEEKLY-TOP-RANKING | reach_or_save | SS-20260703-WEEKLY-TOP5, SS-20260731-WEEKLY-LOVE-TOP5, SS-20260731-WEEKLY-LOVE-REPLIES | weekly_ranking |
| SS-P02-DAILY-12-ZODIAC-BOARD | reach | SS-20260722-DAILY-12-ZODIAC, SS-20260730-DAILY-RANKING | daily_zodiac |
| SS-P03-SECRET-INSIDE-OUTSIDE | engagement | SS-20260802-GOAT-INNER-WORLD, SS-20260805-HIDDEN-PAIN, SS-20260807-HIDDEN-MIND | inner_world |
| SS-P04-FREE-READING-GATE | conversion | SS-20260716-FREE-READING, SS-20260722-COLOR-WARNING, SS-20260802-GOAT-INNER-WORLD, SS-20260805-HIDDEN-PAIN | free_reading |
| SS-P05-WARNING-WITH-RELIEF | reach_or_engagement | SS-20260722-COLOR-WARNING, SS-20260722-DAILY-12-ZODIAC, SS-20260730-DAILY-RANKING | daily_zodiac, warning_card |
| SS-P06-TECHNICAL-TO-EVERYDAY | trust_or_conversion | SS-20260716-FREE-READING, SS-20260730-DAILY-RANKING, SS-20260805-HIDDEN-PAIN | individual_reading |
| SS-P07-APP-ORIGIN-COMMUNITY | conversion | SS-20260725-APP-LAUNCH | app_story |
| SS-P08-ZODIAC-TO-DAY-PILLAR-UPSELL | conversion | SS-20260722-DAILY-12-ZODIAC, SS-20260722-COLOR-WARNING, SS-20260730-DAILY-RANKING, SS-20260731-WEEKLY-LOVE-TOP5, SS-20260802-GOAT-INNER-WORLD, SS-20260805-HIDDEN-PAIN, SS-20260807-HIDDEN-MIND | app_story |
