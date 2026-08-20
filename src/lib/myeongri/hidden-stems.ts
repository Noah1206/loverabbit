// 지장간(支藏干) 정본 테이블 — 이 저장소에서 지지 속 천간을 말하는 단 한 곳.
//
// 지금까지 코드는 지지를 본기 오행 하나로만 읽었다(saju.ts의 JIJI_OHAENG).
// 그것만으로는 통근(通根)도 투간(透干)도 볼 수 없어, 여기서 여기·중기·본기를
// 역할까지 붙여 정규화한다.
//
// ── 출처와 판본 ─────────────────────────────────────────────────────
// 아래 표는 자평명리에서 널리 쓰이는 표준 지장간 배열이다.
// 판본이 갈리는 자리가 있으므로 그대로 두지 말고 채택 출처를 확정해야 한다:
//   · 해(亥)의 여기를 무(戊)로 두는 표와, 임(壬)·갑(甲) 둘만 두는 표가 있다
//   · 오(午)의 중기를 기(己)로 두는 표와 두지 않는 표가 있다
//   · 일수(日數) 배분(여기/중기/본기가 각각 며칠인가)은 표마다 다르다 — 여기서는
//     일수를 쓰지 않으므로 담지 않았다. 월령 심천(深淺)을 보려면 그때 정해야 한다
// 미결정 항목으로 docs/myeongri/calculation-policy.md 에 남겨 두었다.

import { CHEONGAN, CHEONGAN_OHAENG, JIJI, type Ohaeng } from "@/lib/saju";

/** 지장간이 그 지지에서 맡는 자리 */
export type HiddenStemRole = "main" | "middle" | "residual";

export interface HiddenStem {
  /** 천간 (한글) */
  stem: string;
  role: HiddenStemRole;
  element: Ohaeng;
  polarity: "yang" | "yin";
  /** 어느 표에서 온 값인지 */
  sourceReference: string;
}

/** 지지의 음양을 체(體)로 볼 때와 본기로 볼 때가 어떻게 갈리는지 한눈에 */
export interface BranchPolaritySource {
  branch: string;
  bodyPolarity: "yang" | "yin";
  mainHiddenStem: string;
  mainHiddenStemPolarity: "yang" | "yin";
  /** 두 판정이 어긋나는가 — 자·사·오·해 넷이 여기 걸린다 */
  differsFromBody: boolean;
  sourceReference: string;
}

/** 이 표의 판본 식별자. 바뀌면 계산 결과가 바뀌므로 감사 기록에 함께 남긴다. */
export const HIDDEN_STEM_TABLE_VERSION = "jipyeong-standard-2026-08";

const REF = HIDDEN_STEM_TABLE_VERSION;

/**
 * 자축인묘진사오미신유술해 순서. 각 배열은 [여기, 중기, 본기] 순으로 적되,
 * 여기·중기가 없는 지지는 그 자리를 비운다.
 */
const TABLE: { residual?: string; middle?: string; main: string }[] = [
  /* 자 */ { residual: "임", main: "계" },
  /* 축 */ { residual: "계", middle: "신", main: "기" },
  /* 인 */ { residual: "무", middle: "병", main: "갑" },
  /* 묘 */ { residual: "갑", main: "을" },
  /* 진 */ { residual: "을", middle: "계", main: "무" },
  /* 사 */ { residual: "무", middle: "경", main: "병" },
  /* 오 */ { residual: "병", middle: "기", main: "정" },
  /* 미 */ { residual: "정", middle: "을", main: "기" },
  /* 신 */ { residual: "무", middle: "임", main: "경" },
  /* 유 */ { residual: "경", main: "신" },
  /* 술 */ { residual: "신", middle: "정", main: "무" },
  /* 해 */ { residual: "무", middle: "갑", main: "임" },
];

function stemIndex(stem: string): number {
  const i = CHEONGAN.indexOf(stem as (typeof CHEONGAN)[number]);
  if (i < 0) throw new Error(`알 수 없는 천간: ${stem}`);
  return i;
}

/** 천간의 음양 — 갑병무경임이 양, 을정기신계가 음 */
export function stemPolarity(stem: string): "yang" | "yin" {
  return stemIndex(stem) % 2 === 0 ? "yang" : "yin";
}

export function stemElementOf(stem: string): Ohaeng {
  return CHEONGAN_OHAENG[stemIndex(stem)] as Ohaeng;
}

function build(stem: string, role: HiddenStemRole): HiddenStem {
  return { stem, role, element: stemElementOf(stem), polarity: stemPolarity(stem), sourceReference: REF };
}

/**
 * 지지 하나의 지장간 전부. 본기가 항상 먼저 오고, 그다음 중기, 여기 순이다.
 * (표기 순서는 여기→본기지만, 쓰는 쪽은 대개 본기부터 본다)
 */
export function hiddenStemsOf(jiIdx: number): HiddenStem[] {
  const row = TABLE[jiIdx];
  if (!row) throw new Error(`지지 색인이 범위를 벗어남: ${jiIdx}`);
  const out: HiddenStem[] = [build(row.main, "main")];
  if (row.middle) out.push(build(row.middle, "middle"));
  if (row.residual) out.push(build(row.residual, "residual"));
  return out;
}

/** 본기 하나만 — 기존에 본기만 쓰던 자리를 위한 지름길 */
export function mainHiddenStemOf(jiIdx: number): HiddenStem {
  return hiddenStemsOf(jiIdx)[0];
}

/** 12지지 전체의 체 음양 대 본기 음양 대조표 */
export function branchPolarityTable(): BranchPolaritySource[] {
  return JIJI.map((branch, jiIdx) => {
    const main = mainHiddenStemOf(jiIdx);
    const bodyPolarity: "yang" | "yin" = jiIdx % 2 === 0 ? "yang" : "yin";
    return {
      branch,
      bodyPolarity,
      mainHiddenStem: main.stem,
      mainHiddenStemPolarity: main.polarity,
      differsFromBody: bodyPolarity !== main.polarity,
      sourceReference: REF,
    };
  });
}
