import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { JIJI } from "@/lib/saju";
import {
  branchPolarityTable,
  hiddenStemsOf,
  mainHiddenStemOf,
  stemPolarity,
} from "@/lib/myeongri/hidden-stems";
import { branchIsYang } from "@/lib/myeongri/policy";

describe("지장간 표", () => {
  it("12지지 전부가 본기를 갖는다", () => {
    for (let i = 0; i < 12; i += 1) {
      const main = mainHiddenStemOf(i);
      assert.ok(main.stem, `${JIJI[i]} 의 본기가 비었다`);
      assert.equal(main.role, "main");
    }
  });

  it("본기가 항상 첫 번째로 나온다", () => {
    for (let i = 0; i < 12; i += 1) {
      assert.equal(hiddenStemsOf(i)[0].role, "main", `${JIJI[i]}`);
    }
  });

  it("역할은 main/middle/residual 뿐이고 중복되지 않는다", () => {
    for (let i = 0; i < 12; i += 1) {
      const roles = hiddenStemsOf(i).map((h) => h.role);
      assert.equal(new Set(roles).size, roles.length, `${JIJI[i]} 에 같은 역할이 둘 있다`);
      for (const r of roles) assert.ok(["main", "middle", "residual"].includes(r));
    }
  });

  it("자·묘·유는 중기가 없고 나머지는 여기·중기·본기 셋을 갖는다", () => {
    const twoStem = ["자", "묘", "유"];
    for (let i = 0; i < 12; i += 1) {
      const n = hiddenStemsOf(i).length;
      assert.equal(n, twoStem.includes(JIJI[i]) ? 2 : 3, `${JIJI[i]} 의 지장간 수`);
    }
  });

  it("천간 음양 — 갑병무경임이 양, 을정기신계가 음", () => {
    for (const s of ["갑", "병", "무", "경", "임"]) assert.equal(stemPolarity(s), "yang", s);
    for (const s of ["을", "정", "기", "신", "계"]) assert.equal(stemPolarity(s), "yin", s);
  });
});

describe("체 음양 대 본기 음양", () => {
  const table = branchPolarityTable();

  it("자·사·오·해 넷에서만 갈린다", () => {
    const differ = table.filter((r) => r.differsFromBody).map((r) => r.branch);
    assert.deepEqual(differ.sort(), ["사", "오", "자", "해"].sort());
  });

  it("갈리는 넷의 본기가 표와 맞는다", () => {
    const want: Record<string, [string, "yang" | "yin", "yang" | "yin"]> = {
      // 지지: [본기, 체 음양, 본기 음양]
      자: ["계", "yang", "yin"],
      사: ["병", "yin", "yang"],
      오: ["정", "yang", "yin"],
      해: ["임", "yin", "yang"],
    };
    for (const [branch, [stem, body, main]] of Object.entries(want)) {
      const row = table.find((r) => r.branch === branch);
      assert.ok(row, `${branch} 행이 없다`);
      assert.equal(row.mainHiddenStem, stem, `${branch} 본기`);
      assert.equal(row.bodyPolarity, body, `${branch} 체 음양`);
      assert.equal(row.mainHiddenStemPolarity, main, `${branch} 본기 음양`);
    }
  });

  it("나머지 여덟은 체와 본기가 같다", () => {
    for (const row of table.filter((r) => !["자", "사", "오", "해"].includes(r.branch))) {
      assert.equal(row.bodyPolarity, row.mainHiddenStemPolarity, `${row.branch}`);
    }
  });

  it("branchIsYang 이 모드에 따라 자·사·오·해에서만 뒤집힌다", () => {
    for (let i = 0; i < 12; i += 1) {
      const body = branchIsYang(i, "body");
      const main = branchIsYang(i, "main_hidden_stem");
      const shouldDiffer = ["자", "사", "오", "해"].includes(JIJI[i]);
      assert.equal(body !== main, shouldDiffer, `${JIJI[i]} — body=${body} main=${main}`);
    }
  });

  it("체 모드는 짝수 색인이 양이라는 기존 규칙과 같다", () => {
    for (let i = 0; i < 12; i += 1) {
      assert.equal(branchIsYang(i, "body"), i % 2 === 0, `${JIJI[i]}`);
    }
  });
});
