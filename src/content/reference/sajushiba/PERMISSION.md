# 사주시바 원문 재사용 허가 기록

- 권리/허가 상태: 운영자 확인 완료
- 허용 범위: 원문 문장·문단·카피 구조·소재·CTA·이미지/캐러셀 구성을 러브레빗 콘텐츠에 직접 재사용하거나 변형해 사용하는 것
- 소스 범위: `corpus.v1.jsonl`에 포함된 source post ID만
- 제외 범위: 코퍼스 밖의 제3자 계정/게시물
- 운영 책임자: **<사용자가 입력>**
- 확인일: **<사용자가 입력>**
- 허가 증빙: **<이메일/DM/계약서/메모 파일 경로를 사용자가 입력>**

---

## 지금 열려 있는 것과 잠겨 있는 것

굵게 표시된 세 항목이 비어 있습니다. 그래서 원문 **문장을 그대로 옮기는 모드**는
아직 잠겨 있습니다. `THREADS_ALLOW_DIRECT_COPY=1` 로 켜도 열리지 않습니다 —
이건 실패가 아니라 `needs_permission_metadata` 상태입니다.

| 모드 | 원문 문장을 옮기는가 | 지금 상태 |
|---|---|---|
| `pattern_only` | 아니오 (훅·리듬·구조만) | **열림** |
| `close_adaptation` | 아니오 (문단 순서·호흡 유지, 문장은 새로 씀) | **열림** |
| `verbatim_excerpt` | 예 (선택 문장 그대로) | 잠김 — 세 항목 필요 |
| `verbatim_full_post` | 예 (전체 문단 순서 보존) | 잠김 — 세 항목 필요 |

앞의 두 모드에 증빙을 요구하지 않는 이유는, 그 둘이 원문 문장을 옮기지 않기
때문입니다. 구조와 리듬은 `pattern-library.v1.json` 이 이미 일반화해 둔 층입니다.

## 여는 방법

1. 위 굵은 세 항목을 채웁니다.
   - **운영 책임자** — 허가를 확인한 사람 이름
   - **확인일** — `YYYY-MM-DD`
   - **허가 증빙** — 이메일/DM 캡처/계약서/메모의 실제 파일 경로 (예: `docs/permissions/sajushiba-dm-20260820.png`)
2. 같은 값을 `permission-registry.ts` 의 `PERMISSION_EVIDENCE` 에 넣습니다.
3. `npm run threads:permission:status` 로 확인합니다.

두 곳에 적는 이유는, 코드만 고치고 기록을 안 남기는 일과 기록만 남기고 코드를
안 고치는 일을 둘 다 막기 위해서입니다.

## 게시물별 허용 범위

실제 값은 `permission-registry.ts` 의 `PERMISSION_REGISTRY` 가 갖고 있습니다.
아래는 그 요약이며, 원문에 무엇이 섞여 있는지에 따라 갈립니다.

| source post | 최대 허용 모드 | 왜 |
|---|---|---|
| `SS-20260805-HIDDEN-PAIN` | `verbatim_full_post` | 브랜드·링크·시의성이 전부 없음 |
| `SS-20260807-HIDDEN-MIND` | `verbatim_full_post` | 같음 |
| `SS-20260716-FREE-READING` | `verbatim_excerpt` | 브랜드·링크·모집 조건이 섞여 있어 구간을 골라야 함 |
| `SS-20260730-DAILY-RANKING` | `verbatim_excerpt` | 순위·간지 구간을 빼야 함 |
| `SS-20260802-GOAT-INNER-WORLD` | `verbatim_excerpt` | 링크만 섞임 |
| `SS-20260731-WEEKLY-LOVE-REPLIES` | `pattern_only` | 부모 글이 없어 문맥이 잘림 |
| 나머지 5개 | `close_adaptation` | 순위·점수·색 등 승인 테이블이 없는 축이 뼈대임 |

## 코퍼스 자체가 기록하는 출처

허가와 별개로, 원문이 어떻게 수집됐는지는 코퍼스가 기록하고 있습니다.
11개 행 전부 `source_method: public_threads_extraction`,
`permission_scope: user_asserted_style_and_copy_reuse` 입니다.
사주시바 측이 직접 내보낸 파일을 합치면 이 값이 달라지고, 검증기가 advisory 를
냅니다. 그때가 위 증빙 세 줄이 가장 튼튼해지는 시점입니다.

## v1 코퍼스의 범위 한계

공개 접근이 가능했던 **11개 고유 게시물**만 들어 있습니다. 계정 전체 원문이
필요하면 같은 JSONL 포맷으로 합쳐야 하고, 필요한 필드는 `threads-corpus.ts` 의
`REQUIRED_FIELDS` 가 정의합니다. 합칠 때 `permission-registry.ts` 에도 행을
추가해야 합니다 — 레지스트리에 없는 게시물은 `unknown_source` 로 막힙니다.
