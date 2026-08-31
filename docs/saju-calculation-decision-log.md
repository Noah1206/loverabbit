# 사주 계산 결정 기록 — 지시문 부록 19 대비 (2026-08-31)

부록 19 는 만세력·오행 TypeScript 기준 구현을 제시하면서 "기존 엔진이 있으면
그것을 source of truth 로 삼고 부록 코드는 직접 쓰지 말라"고 스스로 지시한다.
러브레빗에는 검증된 엔진이 이미 있어 **부록 코드를 채택하지 않았다.**

| 부록 19 항목 | 실제 사용 | 비고 |
|---|---|---|
| 연주·월주 (입춘·절기 경계) | `computeSaju` (`src/lib/saju.ts`) | 입춘 경계 처리 내장, 골든 테스트(`tests/manseryeok.test.ts`) 존재 |
| 일주 기준일·자시(23시) 경계 | `computeSaju` | 서비스 전체(리딩·귀인지도)가 같은 정책을 공유 |
| 시주 | `computeSaju` — 단, 귀인지도 관계 축은 시간을 아예 안 쓴다 | 일간 오행·음양은 날짜만으로 확정 → 시간 미상 무감점 |
| 음력 변환 | `korean-lunar-calendar` 기반 `src/lib/lunar.ts` | 부록의 "검증된 adapter" 요구 충족 |
| 오행 생극 표 | `GENERATES`/`CONTROLS` (`src/lib/saju-facts.ts`) | 한글 오행(목화토금수) 표기 — 부록의 영문 enum 대신 저장소 규칙 |
| 음양 | 천간 인덱스 짝수=양 (`ganIdx % 2 === 0`) | 부록의 STEM_POLARITY 표와 동치 |
| 지장간·십신 | `saju-facts.ts` (`tenGodOf`, `HIDDEN_STEMS` 상당) | 귀인지도 v3 축 계산에는 미사용 (v1 십성 역할의 잔재만 표시용) |
| seasonalStrength | 미연결 — 중립 0.60 고정 | 기존 엔진의 조후 강도를 잇는 것은 P1 (v2 때 결정 유지) |
| structuralHarmony (합충 보정) | 미사용 | 축 수식이 19.11 계열(구조 보정 없는 버전)이라 임의 추정값을 안 만든다 |

timezone: 서비스가 국내 전용이라 입력은 Asia/Seoul 전제이고, 계산은 날짜
단위(연·월·일)라 브라우저 로컬 시간대에 의존하는 경로가 없다.
