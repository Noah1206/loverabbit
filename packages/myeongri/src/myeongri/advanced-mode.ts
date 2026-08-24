// 고급 해석을 어디까지 쓸 것인가.
//
// 이 플래그 하나가 이번 층 전체의 안전장치다. 기본값은 evidence_only —
// 계산은 다 하되 사용자가 읽는 글은 한 글자도 바뀌지 않는다.
//
// 왜 이렇게까지 하는가. 조후·격국·용신은 틀려도 드러나지 않는 층이기 때문이다.
// 만세력이 틀리면 다른 만세력과 대조해 알 수 있지만, "당신의 용신은 화입니다" 는
// 학설이 갈리는 자리라 반증할 데가 없다. 그래서 켜는 일이 조심스러워야 한다.

export type AdvancedMyeongriMode = "evidence_only" | "policy_preview" | "policy_enabled";

/**
 * 2026-08-21: evidence_only -> policy_preview.
 *
 * 승인 순서 6단계 중 넷이 끝났고, 그중 1단계(계절의 한난조습)는 고전 판본이 필요
 * 없는 계산층이다. 축월에 났다는 것, 소한이 지나고 보름이 됐다는 것, 그 달이
 * 한랭하고 습하다는 것은 학설이 갈리는 자리가 아니다.
 *
 * 조후용신·격국 이름·용신은 이 모드에서도 나가지 않는다. 판본이 없기 때문이고,
 * 그 차단은 모드가 아니라 출처가 한다(source-registry.ts).
 */
export const DEFAULT_ADVANCED_MODE: AdvancedMyeongriMode = "policy_preview";

/**
 * evidence_only   계산·감사·관리 화면에만. 사용자 리포트의 결론도 강약 라벨도 안 바꾼다.
 * policy_preview  승인된 출처 정책 범위에서만, 리포트의 '고급 해석 미리보기' 구간에.
 *                 기존 결론을 대체하지 않는다.
 * policy_enabled  출처 표·가중치·우선순위·회귀 세트가 모두 승인된 뒤에만.
 */
export function advancedMode(): AdvancedMyeongriMode {
  const raw = process.env.ADVANCED_MYEONGRI_MODE;
  if (raw === "evidence_only" || raw === "policy_preview" || raw === "policy_enabled") return raw;
  if (raw) {
    console.warn(
      `ADVANCED_MYEONGRI_MODE="${raw}" 는 알 수 없는 값입니다. ` +
        `evidence_only | policy_preview | policy_enabled 중 하나여야 합니다. ` +
        `기본값 "${DEFAULT_ADVANCED_MODE}" 로 진행합니다.`
    );
  }
  return DEFAULT_ADVANCED_MODE;
}

/** 이 모드에서 고급 해석이 사용자 글에 닿을 수 있는가 */
export function advancedReachesReader(mode: AdvancedMyeongriMode = advancedMode()): boolean {
  return mode !== "evidence_only";
}

/** 이 모드에서 고급 해석이 기존 결론을 갈아 끼울 수 있는가 */
export function advancedMayOverride(mode: AdvancedMyeongriMode = advancedMode()): boolean {
  return mode === "policy_enabled";
}
