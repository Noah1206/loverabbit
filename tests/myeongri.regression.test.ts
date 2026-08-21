// 기존 동작이 바뀌지 않았는지 붙잡아 두는 자물쇠.
//
// BASELINE_BODY 는 이번 작업 **전에** 돌려 받아 적은 값이고 한 글자도 고치지 않았다.
// 다만 그때는 body 가 기본값이라 모드를 안 적었을 뿐이고, 2026-08-20 에 기본값이
// main_hidden_stem 으로 바뀌었으므로 이제 어느 모드의 기대인지 명시해서 돌린다.
//
// BASELINE_MAIN 은 전환 시점에 새로 받아 적은 값이다. 두 모드를 **둘 다** 못박아,
// 어느 쪽으로 기본값이 움직여도 나머지 한쪽이 조용히 무너지지 않게 한다.
//
// 이 테스트가 깨지면 기대값을 고치지 말고 왜 달라졌는지부터 밝혀야 한다.
//
// 2026-08-21 — 강약 판정이 strength-v1 표로 바뀌었다. 그래서 아래 strength/score 는
// **옛 셈법(STRENGTH_POLICY=legacy)의 값**이고, 한 글자도 고치지 않았다. 대신 그 값을
// legacy 모드에서 재고, 새 표의 값은 STRENGTH_APPLIED 에 따로 받아 적었다.
// 두 표를 둘 다 못박아 두면, 어느 쪽으로 기본값이 움직여도 나머지 한쪽이 조용히
// 무너지지 않는다 — 지지 음양 모드에 대해 이미 하고 있던 것과 같은 방식이다.
//
// 이 전환에서 사주·십성·신살은 한 건도 달라지지 않았다. 계산층은 그대로다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildSajuFacts } from "@/lib/saju-facts";
import { DEFAULT_BRANCH_YIN_YANG_MODE, branchYinYangMode } from "@/lib/myeongri/policy";

interface Baseline {
  label: string;
  birth: { year: number; month: number; day: number; hour: number | null; gender: "F" | "M" };
  pillars: string;
  tenGods: string;
  strength: string;
  score: number;
  shinsal: string;
}

/** BRANCH_YIN_YANG_MODE=body — 작업 전 스냅샷. 값은 그대로다. */
const BASELINE_BODY: Baseline[] = [
  {
    label: "1999-10-02 14시 F",
    birth: { year: 1999, month: 10, day: 2, hour: 14, gender: "F" },
    pillars: "기묘 계유 정해 정미",
    tenGods: "연간=식신 연지=편인 월간=편관 월지=편재 일지=편관 시간=비견 시지=식신",
    strength: "신약",
    score: 18,
    shinsal: "홍염,화개",
  },
  {
    label: "1997-03-11 09시 M",
    birth: { year: 1997, month: 3, day: 11, hour: 9, gender: "M" },
    pillars: "정축 계묘 임자 갑진",
    tenGods: "연간=정재 연지=정관 월간=겁재 월지=상관 일지=비견 시간=식신 시지=편관",
    strength: "중화",
    score: 46,
    shinsal: "홍염,화개,양인",
  },
  {
    label: "2000-02-02 12시 F",
    birth: { year: 2000, month: 2, day: 2, hour: 12, gender: "F" },
    pillars: "기묘 정축 경인 임오",
    tenGods: "연간=정인 연지=정재 월간=정관 월지=정인 일지=편재 시간=식신 시지=편관",
    strength: "중화",
    score: 58,
    shinsal: "도화,원진",
  },
];

/**
 * BRANCH_YIN_YANG_MODE=main_hidden_stem — 2026-08-20 전환 시점의 스냅샷.
 *
 * body 와 갈리는 것은 십성뿐이다. 사주·강약·점수·신살은 두 모드가 같다.
 * 갈리는 자리를 주석으로 적어 둔다 — 어디가 바뀌는지 눈으로 확인할 수 있어야 한다.
 */
const BASELINE_MAIN: Baseline[] = [
  {
    label: "1999-10-02 14시 F",
    birth: { year: 1999, month: 10, day: 2, hour: 14, gender: "F" },
    pillars: "기묘 계유 정해 정미",
    // 일지(해) 편관 -> 정관. 여자 명식이라 배우자성이 바뀐 자리다.
    tenGods: "연간=식신 연지=편인 월간=편관 월지=편재 일지=정관 시간=비견 시지=식신",
    strength: "신약",
    score: 18,
    shinsal: "홍염,화개",
  },
  {
    label: "1997-03-11 09시 M",
    birth: { year: 1997, month: 3, day: 11, hour: 9, gender: "M" },
    pillars: "정축 계묘 임자 갑진",
    // 일지(자) 비견 -> 겁재.
    tenGods: "연간=정재 연지=정관 월간=겁재 월지=상관 일지=겁재 시간=식신 시지=편관",
    strength: "중화",
    score: 46,
    shinsal: "홍염,화개,양인",
  },
  {
    label: "2000-02-02 12시 F",
    birth: { year: 2000, month: 2, day: 2, hour: 12, gender: "F" },
    pillars: "기묘 정축 경인 임오",
    // 시지(오) 편관 -> 정관.
    tenGods: "연간=정인 연지=정재 월간=정관 월지=정인 일지=편재 시간=식신 시지=정관",
    strength: "중화",
    score: 58,
    shinsal: "도화,원진",
  },
];

describe("운영 기본값", () => {
  it("지지 음양 모드의 기본값은 main_hidden_stem 이다 — 지시로 정한 값이다", () => {
    // 2026-08-20 body -> main_hidden_stem. 어느 쪽이 맞다는 근거가 아니라
    // 운영자의 지시로 바꾼 것이고, 그 사실을 policy.ts 주석에도 적어 두었다.
    assert.equal(DEFAULT_BRANCH_YIN_YANG_MODE, "main_hidden_stem");
  });

  it("환경변수를 안 주면 기본값으로 돈다", () => {
    delete process.env.BRANCH_YIN_YANG_MODE;
    assert.equal(branchYinYangMode(), DEFAULT_BRANCH_YIN_YANG_MODE);
  });

  it("알 수 없는 값이면 경고하고 기본값으로 떨어진다", () => {
    process.env.BRANCH_YIN_YANG_MODE = "잘못된값";
    assert.equal(branchYinYangMode(), DEFAULT_BRANCH_YIN_YANG_MODE);
    delete process.env.BRANCH_YIN_YANG_MODE;
  });

  it("body 를 명시하면 그대로 읽는다 — 되돌릴 길이 살아 있어야 한다", () => {
    process.env.BRANCH_YIN_YANG_MODE = "body";
    assert.equal(branchYinYangMode(), "body");
    delete process.env.BRANCH_YIN_YANG_MODE;
  });

  it("main_hidden_stem 을 명시하면 그대로 읽는다", () => {
    process.env.BRANCH_YIN_YANG_MODE = "main_hidden_stem";
    assert.equal(branchYinYangMode(), "main_hidden_stem");
    delete process.env.BRANCH_YIN_YANG_MODE;
  });
});

function checkBaseline(mode: "body" | "main_hidden_stem", baselines: Baseline[]) {
  for (const b of baselines) {
    it(b.label, () => {
      process.env.BRANCH_YIN_YANG_MODE = mode;
      // 아래 strength/score 는 옛 셈법의 값이다. 새 표의 값은 STRENGTH_APPLIED 가 잡는다.
      process.env.STRENGTH_POLICY = "legacy";
      const f = buildSajuFacts(b.birth);
      const pillars = [f.fourPillars.year, f.fourPillars.month, f.fourPillars.day, f.fourPillars.hour]
        .map((p) => (p ? p.stem + p.branch : "—"))
        .join(" ");
      assert.equal(pillars, b.pillars, "사주가 달라졌다");
      assert.equal(f.tenGods.map((t) => `${t.position}=${t.tenGod}`).join(" "), b.tenGods, "십성이 달라졌다");
      assert.equal(f.strength.label, b.strength, "강약 판정이 달라졌다");
      assert.equal(f.strength.score, b.score, "강약 점수가 달라졌다");
      assert.equal(f.shinsal.map((s) => s.name).join(","), b.shinsal, "신살이 달라졌다");
      assert.equal(f.policy.branchYinYangMode, mode, "정책 표식이 실제 모드와 다르다");
      delete process.env.BRANCH_YIN_YANG_MODE;
      delete process.env.STRENGTH_POLICY;
    });
  }
}

describe("body 모드 — 작업 전 스냅샷과 같은 값을 낸다", () => {
  checkBaseline("body", BASELINE_BODY);
});

describe("main_hidden_stem 모드 — 전환 시점 스냅샷과 같은 값을 낸다", () => {
  checkBaseline("main_hidden_stem", BASELINE_MAIN);
});

describe("두 모드가 십성에서만 갈린다", () => {
  // 사주·강약·점수·신살은 지지 음양과 무관하다. 이것이 무너지면
  // 음양 모드가 십성 밖으로 새어 나간 것이다.
  for (let i = 0; i < BASELINE_BODY.length; i += 1) {
    const body = BASELINE_BODY[i];
    const main = BASELINE_MAIN[i];
    it(body.label, () => {
      assert.equal(main.pillars, body.pillars, "사주가 모드에 따라 달라졌다");
      assert.equal(main.strength, body.strength, "강약이 모드에 따라 달라졌다");
      assert.equal(main.score, body.score, "점수가 모드에 따라 달라졌다");
      assert.equal(main.shinsal, body.shinsal, "신살이 모드에 따라 달라졌다");
      assert.notEqual(main.tenGods, body.tenGods, "이 명식은 갈리는 지지를 갖고 있어야 한다");
    });
  }
});

describe("새로 붙인 것이 기존 필드를 건드리지 않는다", () => {
  delete process.env.BRANCH_YIN_YANG_MODE;
  const f = buildSajuFacts(BASELINE_BODY[0].birth);

  it("형·통근·정책 표식이 실려 나온다", () => {
    assert.ok(Array.isArray(f.xing));
    assert.ok(Array.isArray(f.xingLuck));
    assert.ok(Array.isArray(f.strengthEvidence.rooting));
    assert.ok(Array.isArray(f.strengthEvidence.exposed));
    assert.equal(f.policy.branchYinYangMode, DEFAULT_BRANCH_YIN_YANG_MODE);
    assert.ok(f.policy.calculationPolicyVersion);
    assert.ok(f.policy.hiddenStemTableVersion);
  });

  it("원국의 형과 운의 형이 섞이지 않는다", () => {
    // 운의 글자가 낀 것은 xing 에 있으면 안 되고, 원국만으로 선 것은 xingLuck 에 없어야 한다.
    assert.equal(f.xing.every((x) => x.scope === "natal"), true);
    assert.equal(f.xingLuck.every((x) => x.scope === "luck"), true);
  });

  it("통근이 이제 판정에 실제로 쓰인다", () => {
    // 2026-08-21 이전에는 통근·투간이 증거일 뿐 점수에 반영되지 않았다. 이 테스트는
    // 그 사실을 지키고 있었고, 정책이 승인되면서 지켜야 할 것이 뒤집혔다.
    // 뒤집힌 것을 지우지 않고 방향만 바꿔 둔다 — 무엇이 언제 바뀌었는지가 여기 남는다.
    assert.ok(f.strengthEvidence.rooting.length > 0, "이 명식에 통근이 없다 — 전제가 깨졌다");
    assert.ok(
      f.strength.reasonCodes.some((code) => code.startsWith("통근")),
      "통근이 판정 근거에 안 나온다"
    );
  });

  it("legacy 로 돌리면 옛 점수가 그대로 돌아온다", () => {
    // 되돌릴 길이 살아 있는지 재는 자리다. 가중치가 갈리는 층이라 이 길이 막히면 안 된다.
    process.env.STRENGTH_POLICY = "legacy";
    const back = buildSajuFacts(BASELINE_BODY[0].birth);
    delete process.env.STRENGTH_POLICY;
    assert.equal(back.strength.score, BASELINE_BODY[0].score);
    assert.equal(back.strength.label, BASELINE_BODY[0].strength);
  });

  it("표를 바꿔도 사주·십성·신살은 한 글자도 안 움직인다", () => {
    // 강약은 해석이고 사주는 계산이다. 해석을 바꾸면서 계산이 따라 움직이면
    // 그건 층이 새고 있다는 뜻이다.
    process.env.STRENGTH_POLICY = "legacy";
    const legacy = buildSajuFacts(BASELINE_BODY[0].birth);
    delete process.env.STRENGTH_POLICY;
    const applied = buildSajuFacts(BASELINE_BODY[0].birth);
    const pillars = (x: typeof applied) =>
      [x.fourPillars.year, x.fourPillars.month, x.fourPillars.day, x.fourPillars.hour]
        .map((q) => (q ? q.stem + q.branch : "—"))
        .join(" ");
    assert.equal(pillars(applied), pillars(legacy));
    assert.deepEqual(
      applied.tenGods.map((t) => `${t.position}=${t.tenGod}`),
      legacy.tenGods.map((t) => `${t.position}=${t.tenGod}`)
    );
    assert.deepEqual(
      applied.shinsal.map((x) => x.name),
      legacy.shinsal.map((x) => x.name)
    );
  });
});
