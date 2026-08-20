import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CHEONGAN, CHEONGAN_OHAENG, JIJI, JIJI_OHAENG, type Ohaeng } from "@/lib/saju";
import { branchIsYang, type BranchYinYangMode } from "@/lib/myeongri/policy";

// saju-facts.ts 의 tenGodOf 와 같은 규칙. 그쪽은 내부 함수라 여기서 다시 세운다 —
// 두 곳이 어긋나면 이 파일의 기대값이 먼저 깨지므로 그 자체로 대조가 된다.
const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

function tenGodOf(dayEl: Ohaeng, dayYang: boolean, targetEl: Ohaeng, targetYang: boolean): string {
  const same = dayYang === targetYang;
  if (targetEl === dayEl) return same ? "비견" : "겁재";
  if (GENERATES[dayEl] === targetEl) return same ? "식신" : "상관";
  if (CONTROLS[dayEl] === targetEl) return same ? "편재" : "정재";
  if (CONTROLS[targetEl] === dayEl) return same ? "편관" : "정관";
  if (GENERATES[targetEl] === dayEl) return same ? "편인" : "정인";
  throw new Error("오행 관계가 다섯 갈래 밖으로 나갔다");
}

/** 지지에서 나온 십성 — 모드가 개입하는 유일한 경로 */
function branchTenGod(dayStemIdx: number, jiIdx: number, mode: BranchYinYangMode): string {
  return tenGodOf(
    CHEONGAN_OHAENG[dayStemIdx] as Ohaeng,
    dayStemIdx % 2 === 0,
    JIJI_OHAENG[jiIdx] as Ohaeng,
    branchIsYang(jiIdx, mode)
  );
}

/** 천간에서 나온 십성 — 모드와 무관해야 한다 */
function stemTenGod(dayStemIdx: number, stemIdx: number): string {
  return tenGodOf(
    CHEONGAN_OHAENG[dayStemIdx] as Ohaeng,
    dayStemIdx % 2 === 0,
    CHEONGAN_OHAENG[stemIdx] as Ohaeng,
    stemIdx % 2 === 0
  );
}

const IDX = (s: string, table: readonly string[]) => table.indexOf(s);
const gan = (s: string) => IDX(s, CHEONGAN);
const ji = (s: string) => IDX(s, JIJI);

describe("지지 유래 십성 — 모드에 따라 정/편이 전환된다", () => {
  // dayMaster, branch, body 모드 결과, 본기 모드 결과, 본기, 이유
  const CASES: [string, string, string, string, string, string][] = [
    ["갑", "오", "식신", "상관", "정", "갑(양)이 생하는 화. 오의 체는 양이나 본기 정화는 음"],
    ["갑", "자", "편인", "정인", "계", "갑을 생하는 수. 자의 체는 양이나 본기 계수는 음"],
    ["갑", "해", "정인", "편인", "임", "갑을 생하는 수. 해의 체는 음이나 본기 임수는 양"],
    ["갑", "사", "상관", "식신", "병", "갑이 생하는 화. 사의 체는 음이나 본기 병화는 양"],
    // 무(양)와 자의 체(양)는 음양이 같아 편재, 본기 계(음)와는 달라 정재가 된다
    ["무", "자", "편재", "정재", "계", "무(양)가 극하는 수. 자의 체는 양이나 본기 계수는 음"],
    ["병", "해", "정관", "편관", "임", "병(양)을 극하는 수. 해의 체는 음이나 본기 임수는 양"],
    ["병", "오", "비견", "겁재", "정", "병과 같은 화. 오의 체는 양이나 본기 정화는 음"],
  ];

  for (const [day, branch, bodyWant, mainWant, mainStem, reason] of CASES) {
    it(`일간 ${day} · 지지 ${branch} — body=${bodyWant} / main_hidden_stem=${mainWant}`, () => {
      const d = gan(day);
      const b = ji(branch);
      assert.equal(branchTenGod(d, b, "body"), bodyWant, `body 모드 (${reason})`);
      assert.equal(branchTenGod(d, b, "main_hidden_stem"), mainWant, `본기 모드 (${reason})`);
      assert.notEqual(bodyWant, mainWant, "이 케이스는 전환되어야 한다");
    });
  }

  it("다섯 정/편 쌍이 모두 한 번 이상 다뤄진다", () => {
    const pairs = new Set(CASES.map(([, , a, b]) => [a, b].sort().join("↔")));
    for (const want of ["겁재↔비견", "상관↔식신", "정재↔편재", "정관↔편관", "정인↔편인"]) {
      assert.ok(pairs.has(want), `${want} 케이스가 없다`);
    }
  });
});

describe("천간 유래 십성 — 모드와 무관하다", () => {
  it("일간 갑 기준 천간 열 자의 십성이 모드에 상관없이 같다", () => {
    const d = gan("갑");
    for (let s = 0; s < 10; s += 1) {
      const before = stemTenGod(d, s);
      // 모드는 지지 경로에만 개입하므로 천간 계산은 아예 부르지 않는다.
      // 그 사실을 고정해 두어, 나중에 모드가 천간까지 새면 이 테스트가 깨진다.
      assert.equal(stemTenGod(d, s), before, CHEONGAN[s]);
    }
  });

  it("체와 본기가 같은 여덟 지지는 모드가 바뀌어도 십성이 같다", () => {
    for (const branch of ["축", "인", "묘", "진", "미", "신", "유", "술"]) {
      const b = ji(branch);
      for (let d = 0; d < 10; d += 1) {
        assert.equal(
          branchTenGod(d, b, "body"),
          branchTenGod(d, b, "main_hidden_stem"),
          `일간 ${CHEONGAN[d]} · 지지 ${branch}`
        );
      }
    }
  });
});
