import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUIN_CALC_VERSION, personaOf, relate } from "../src/lib/guin-calc";
import { GUIN_DISCLAIMER, GUIN_ROLES, type GuinBirthInput } from "../src/lib/guin-map";

// 결과 문구가 절대 담으면 안 되는 표현 (지시문 10항).
// 확정·비난·협박조 — 하나라도 걸리면 표현이 아니라 표를 고쳐야 한다.
const FORBIDDEN = ["운명", "반드시", "절대", "무조건", "나쁜 사람", "헤어져", "끊어야", "손해를 본다"];

const birth = (year: number, month: number, day: number, hour: number | null = null): GuinBirthInput => ({
  year,
  month,
  day,
  hour,
});

describe("귀인 관계 계산 (guin-1)", () => {
  it("점수는 항상 5~99 — 0과 100 같은 확정 숫자를 만들지 않는다", () => {
    const years = [1968, 1975, 1983, 1990, 1993, 1997, 2001, 2005];
    const days = [1, 4, 5, 15, 28];
    for (const y1 of years) {
      for (const d1 of days) {
        const a = birth(y1, 3, d1);
        const b = birth(2003 - (y1 % 7), ((d1 * 3) % 12) + 1, ((y1 + d1) % 28) + 1);
        const result = relate(a, b);
        assert.ok(result.score >= 5 && result.score <= 99, `${result.score} 가 범위 밖`);
        assert.ok(result.role in GUIN_ROLES, `모르는 역할 ${result.role}`);
        assert.equal(result.calculationVersion, GUIN_CALC_VERSION);
        assert.ok(result.strengths.length >= 1 && result.strengths.length <= 2);
        assert.ok(result.cautions.length <= 1);
        assert.ok(result.conversationPrompt.length > 0);
      }
    }
  });

  it("같은 입력은 언제나 같은 결과다 (결정론)", () => {
    const a = birth(1993, 8, 21);
    const b = birth(1997, 2, 4);
    assert.deepEqual(relate(a, b), relate(a, b));
  });

  it("태어난 시간은 관계 점수를 움직이지 않는다 — 자시(23시)여도 같다", () => {
    const me = birth(1990, 11, 30);
    const withHour = relate(me, birth(1995, 6, 15, 23));
    const withoutHour = relate(me, birth(1995, 6, 15, null));
    assert.deepEqual(withHour, withoutHour);
  });

  it("같은 생년월일끼리는 거울형이다 (일간이 같으면 비견)", () => {
    const same = birth(1992, 4, 17);
    const result = relate(same, same);
    assert.equal(result.role, "mirror");
    assert.equal(result.roleLabel, "거울형");
  });

  it("결과 문구에 금지 표현이 없다 — 역할 사전과 계산 결과 양쪽 모두", () => {
    const texts: string[] = [GUIN_DISCLAIMER];
    for (const info of Object.values(GUIN_ROLES)) {
      texts.push(info.label, info.tagline, ...info.strengths, ...info.cautions, info.conversationPrompt);
    }
    for (let i = 0; i < 20; i += 1) {
      const result = relate(birth(1970 + i * 2, (i % 12) + 1, (i % 27) + 1), birth(2004 - i, ((i * 5) % 12) + 1, ((i * 7) % 27) + 1));
      texts.push(result.roleLabel, result.roleTagline, ...result.strengths, ...result.cautions, result.conversationPrompt);
    }
    for (const text of texts) {
      for (const word of FORBIDDEN) {
        assert.ok(!text.includes(word), `"${text}" 에 금지 표현 "${word}"`);
      }
    }
  });

  it("경계 날짜에서 터지지 않는다 — 입춘 언저리·월말", () => {
    for (const [m, d] of [[2, 3], [2, 4], [2, 5], [12, 31], [1, 1]] as const) {
      const result = relate(birth(1988, m, d), birth(1999, m, d));
      assert.ok(result.score >= 5 && result.score <= 99);
    }
  });

  it("개인 캐릭터는 파생값만 돌려준다 — 생년월일이 안 들어 있다", () => {
    const persona = personaOf(birth(1993, 8, 21, 14));
    assert.ok(persona.elementLabel.length > 0);
    assert.ok(persona.animal.length > 0);
    const serialized = JSON.stringify(persona);
    assert.ok(!serialized.includes("1993") && !serialized.includes("21"), "생년월일 흔적이 있다");
  });
});
