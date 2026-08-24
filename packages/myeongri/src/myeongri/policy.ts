// 명리 계산에서 유파가 갈리는 선택을 한곳에 모아 둔다.
//
// 여기 있는 값들은 "무엇이 옳은가"가 아니라 "우리가 무엇을 채택했는가"다.
// 바꾸면 이미 발급된 리딩과 다른 결과가 나오므로, 결과·감사 기록에 늘 함께 실어
// 나중에 "이 리딩은 어느 정책으로 뽑았는가"를 되짚을 수 있게 한다.

import { branchPolarityTable, HIDDEN_STEM_TABLE_VERSION } from "../myeongri/hidden-stems";

/**
 * 지지를 십성의 담지자로 읽을 때 음양을 무엇으로 볼 것인가.
 *
 * "body"             지지 자체의 음양. 자인진오신술=양, 축묘사미유해=음.
 * "main_hidden_stem" 지장간 본기의 음양. 자평명리에서 널리 쓰는 쪽.
 *
 * 자·사·오·해 넷에서 갈린다(체양용음 / 체음용양). 그 결과 지지에서 나온 십성이
 * 비견↔겁재, 식신↔상관, 정관↔편관, 정재↔편재, 정인↔편인으로 뒤집힌다.
 *
 * **기본값은 2026-08-20 부터 "main_hidden_stem" 이다.**
 *
 * 이 전환은 **운영자의 지시로 정한 것이지, 어느 쪽이 맞다는 근거로 정한 것이 아니다.**
 * 그 점을 여기 적어 둔다. 감사에서 잰 것은 "얼마나 달라지는가"(무작위 명식의 80%에서
 * 십성이 하나 이상 바뀐다)이지 "어느 쪽이 옳은가"가 아니었고, 지금도 그 판정은 없다.
 * 골든 케이스 100건으로 판정할 방법은 docs/audit/myeongri-regression-report.md 에 있다.
 *
 * 되돌리려면 BRANCH_YIN_YANG_MODE=body 하나면 된다. 이전 기준으로 나간 리딩은
 * SajuFacts.policy 에 찍힌 표식으로 구분된다.
 *
 * 영향 규모는 scripts/audit-branch-yinyang.mts 로 직접 재 볼 수 있다.
 */
export type BranchYinYangMode = "body" | "main_hidden_stem";

export const DEFAULT_BRANCH_YIN_YANG_MODE: BranchYinYangMode = "main_hidden_stem";

const VALID_MODES: BranchYinYangMode[] = ["body", "main_hidden_stem"];

/**
 * 계산 정책 버전. 여기 있는 어떤 선택이든 바뀌면 올린다.
 * 리딩 결과와 감사 보고서에 실려, 나중에 결과를 재현할 때 기준이 된다.
 */
// 1.0.0 -> 1.1.0: 지지 음양 기본값 body -> main_hidden_stem,
//                  부분 삼형 기본값 off -> on, 형을 대운·세운·월운까지 확장.
export const CALCULATION_POLICY_VERSION = "myeongri-policy-1.1.0";

function readMode(): BranchYinYangMode {
  const raw = process.env.BRANCH_YIN_YANG_MODE;
  if (!raw) return DEFAULT_BRANCH_YIN_YANG_MODE;
  if ((VALID_MODES as string[]).includes(raw)) return raw as BranchYinYangMode;
  // 알 수 없는 값이면 멈추지 않고 기존 동작으로 떨어진다 — 설정 오타 하나로
  // 서비스가 죽는 것보다, 경고를 남기고 호환 모드로 도는 편이 낫다.
  console.warn(
    `BRANCH_YIN_YANG_MODE="${raw}" 는 알 수 없는 값입니다. ` +
      `${VALID_MODES.join(" | ")} 중 하나여야 합니다. 기본값 "${DEFAULT_BRANCH_YIN_YANG_MODE}" 로 진행합니다.`
  );
  return DEFAULT_BRANCH_YIN_YANG_MODE;
}

export function branchYinYangMode(): BranchYinYangMode {
  return readMode();
}

/** 결과와 감사 기록에 함께 싣는 계산 정책 표식 */
export interface CalculationPolicyStamp {
  branchYinYangMode: BranchYinYangMode;
  calculationPolicyVersion: string;
  hiddenStemTableVersion: string;
}

export function calculationPolicyStamp(mode: BranchYinYangMode = branchYinYangMode()): CalculationPolicyStamp {
  return {
    branchYinYangMode: mode,
    calculationPolicyVersion: CALCULATION_POLICY_VERSION,
    hiddenStemTableVersion: HIDDEN_STEM_TABLE_VERSION,
  };
}

const POLARITY = branchPolarityTable();

/**
 * 지지의 음양 — 이 함수 하나만 모드를 안다.
 *
 * 십성을 매길 때만 쓴다. 지지의 오행, 합·충·형·해·파, 삼합·방합은 모드와 무관하게
 * 지지 그 자체로 판단하므로 여기를 거치지 않는다.
 */
export function branchIsYang(jiIdx: number, mode: BranchYinYangMode = branchYinYangMode()): boolean {
  const row = POLARITY[jiIdx];
  if (!row) throw new Error(`지지 색인이 범위를 벗어남: ${jiIdx}`);
  return (mode === "main_hidden_stem" ? row.mainHiddenStemPolarity : row.bodyPolarity) === "yang";
}
