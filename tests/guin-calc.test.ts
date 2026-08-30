import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GUIN_CALC_VERSION,
  chemistryOf,
  chooseRole,
  computeFeatures,
  getElementRelation,
  personaOf,
  relate,
  scoreAxes,
} from "../src/lib/guin-calc";
import {
  GUIN_AXES,
  GUIN_DISCLAIMER,
  GUIN_ROLES,
  getMapStage,
  scoreBandOf,
  type GuinBirthInput,
} from "../src/lib/guin-map";
import type { Ohaeng } from "../src/lib/saju";

// 결과 문구가 절대 담으면 안 되는 표현 (지시문 13항).
const FORBIDDEN = ["운명", "반드시", "절대", "무조건", "나쁜 사람", "헤어지", "끊어야", "손해를 본다"];

const birth = (year: number, month: number, day: number, hour: number | null = null): GuinBirthInput => ({
  year,
  month,
  day,
  hour,
});

const ELEMENTS: Ohaeng[] = ["목", "화", "토", "금", "수"];

describe("오행 관계 (지시문 8.2)", () => {
  it("같은 오행은 same 이다", () => {
    for (const element of ELEMENTS) assert.equal(getElementRelation(element, element), "same");
  });

  it("생·극의 방향이 뒤집히지 않는다", () => {
    // 목생화: 주인 목, 참여자 화 → 주인이 참여자를 생한다
    assert.equal(getElementRelation("목", "화"), "owner_generates_participant");
    assert.equal(getElementRelation("화", "목"), "participant_generates_owner");
    // 목극토: 주인 목, 참여자 토 → 주인이 참여자를 극한다
    assert.equal(getElementRelation("목", "토"), "owner_controls_participant");
    assert.equal(getElementRelation("토", "목"), "participant_controls_owner");
  });

  it("다섯 오행의 모든 짝이 다섯 관계 중 하나로 떨어진다", () => {
    for (const a of ELEMENTS) for (const b of ELEMENTS) assert.ok(getElementRelation(a, b));
  });
});

describe("관계 축 채점 (지시문 8.4)", () => {
  it("feature 공간 전체에서 모든 축이 0~100 정수다", () => {
    for (const owner of ELEMENTS) {
      for (const participant of ELEMENTS) {
        for (const polarity of [
          undefined,
          { ownerYang: true, participantYang: true },
          { ownerYang: true, participantYang: false },
        ]) {
          const axes = scoreAxes(computeFeatures({ ownerElement: owner, participantElement: participant, polarity }));
          for (const key of GUIN_AXES) {
            assert.ok(Number.isInteger(axes[key]) && axes[key] >= 0 && axes[key] <= 100, `${key}=${axes[key]}`);
          }
        }
      }
    }
  });

  it("케미도 0~100 이고 가중 평균이 뒤집히지 않는다", () => {
    const even = chemistryOf({ comfort: 80, practicalHelp: 80, communication: 80, stimulation: 80 });
    assert.equal(even, 80);
    const skewed = chemistryOf({ comfort: 100, practicalHelp: 0, communication: 0, stimulation: 0 });
    assert.equal(skewed, 30); // comfort 가중치 0.30
  });
});

describe("역할 선택 (지시문 8.5)", () => {
  it("가장 높은 축이 역할이 된다", () => {
    const { primaryRole, secondaryRole } = chooseRole({ comfort: 90, practicalHelp: 40, communication: 50, stimulation: 30 });
    assert.equal(primaryRole, "comforter");
    assert.equal(secondaryRole, null); // 2위와 40점 차이 — 보조 없음
  });

  it("5점 미만 차이면 보조 역할이 붙는다", () => {
    const { primaryRole, secondaryRole } = chooseRole({ comfort: 80, practicalHelp: 78, communication: 50, stimulation: 30 });
    assert.equal(primaryRole, "comforter");
    assert.equal(secondaryRole, "right_hand");
  });

  it("동점은 축 순서(GUIN_AXES)로 안정적으로 갈린다 — 몇 번을 불러도 같다", () => {
    const axes = { comfort: 70, practicalHelp: 70, communication: 70, stimulation: 70 };
    const first = chooseRole(axes);
    for (let i = 0; i < 10; i += 1) assert.deepEqual(chooseRole(axes), first);
    assert.equal(first.primaryRole, "comforter"); // comfort 가 첫 축
  });
});

describe("관계 하나 (relate, guin-v2)", () => {
  it("같은 입력은 언제나 같은 결과다 (결정론)", () => {
    const a = birth(1993, 8, 21);
    const b = birth(1997, 2, 4);
    assert.deepEqual(relate(a, b), relate(a, b));
  });

  it("출생시간 미상이어도 결과가 나오고, 시간이 점수를 움직이지 않는다", () => {
    const me = birth(1990, 11, 30);
    assert.deepEqual(relate(me, birth(1995, 6, 15, 23)), relate(me, birth(1995, 6, 15, null)));
  });

  it("계산 버전이 결과에 저장된다", () => {
    const result = relate(birth(1993, 8, 21), birth(1994, 7, 18));
    assert.equal(result.calculationVersion, GUIN_CALC_VERSION);
    assert.equal(GUIN_CALC_VERSION, "guin-v2");
    assert.ok(result.axes, "축 점수가 결과에 없다");
    assert.ok(result.scoreBand && result.scoreBand.length > 0);
  });

  it("같은 생년월일끼리 — 같은 오행·같은 극이면 대화형이 1위, 안식처형이 보조로 붙는다", () => {
    const same = birth(1992, 4, 17);
    const result = relate(same, same);
    assert.equal(result.role, "communicator");
    assert.equal(result.secondaryRole, "comforter");
    assert.equal(result.axes?.communication, 80);
    assert.equal(result.axes?.comfort, 78);
    assert.equal(result.score, 63);
    assert.equal(result.scoreBand, "맞춰가면 좋은 균형형 관계");
  });

  it("넓은 입력에서 점수·역할·축이 전부 유효 범위다", () => {
    const years = [1968, 1975, 1983, 1990, 1993, 1997, 2001, 2005];
    for (const y of years) {
      const a = birth(y, 3, ((y * 7) % 27) + 1);
      const b = birth(2003 - (y % 9), ((y * 3) % 12) + 1, ((y + 11) % 27) + 1);
      const result = relate(a, b);
      assert.ok(result.score >= 0 && result.score <= 100);
      assert.ok(result.role in GUIN_ROLES);
      for (const key of GUIN_AXES) {
        const value = result.axes![key];
        assert.ok(value >= 0 && value <= 100, `${key}=${value}`);
      }
    }
  });

  it("경계 날짜에서 터지지 않는다 — 입춘 언저리·연말연시", () => {
    for (const [m, d] of [[2, 3], [2, 4], [2, 5], [12, 31], [1, 1]] as const) {
      assert.ok(relate(birth(1988, m, d), birth(1999, m, d)).score >= 0);
    }
  });
});

describe("표현 원칙 (지시문 13)", () => {
  it("역할 사전·구간 표현·결과 문구에 금지 표현이 없다", () => {
    const texts: string[] = [GUIN_DISCLAIMER];
    for (const info of Object.values(GUIN_ROLES)) {
      texts.push(info.label, info.tagline, ...info.strengths, ...info.cautions, info.conversationPrompt);
    }
    for (const score of [0, 30, 59, 60, 74, 75, 89, 90, 100]) texts.push(scoreBandOf(score));
    for (let i = 0; i < 20; i += 1) {
      const result = relate(
        birth(1970 + i * 2, (i % 12) + 1, (i % 27) + 1),
        birth(2004 - i, ((i * 5) % 12) + 1, ((i * 7) % 27) + 1)
      );
      texts.push(result.roleLabel, result.roleTagline, result.scoreBand ?? "", ...result.strengths, ...result.cautions, result.conversationPrompt);
    }
    for (const text of texts) {
      for (const word of FORBIDDEN) {
        assert.ok(!text.includes(word), `"${text}" 에 금지 표현 "${word}"`);
      }
    }
  });
});

describe("지도 단계와 개인 캐릭터", () => {
  it("인원 → 단계 (지시문 11)", () => {
    assert.equal(getMapStage(0), "empty");
    assert.equal(getMapStage(1), "one");
    assert.equal(getMapStage(2), "two");
    assert.equal(getMapStage(3), "three_plus");
    assert.equal(getMapStage(12), "three_plus");
  });

  it("개인 캐릭터는 파생값만 돌려준다 — 생년월일이 안 들어 있다", () => {
    const persona = personaOf(birth(1993, 8, 21, 14));
    assert.ok(persona.elementLabel.length > 0 && persona.animal.length > 0);
    const serialized = JSON.stringify(persona);
    assert.ok(!serialized.includes("1993") && !serialized.includes("21"));
  });
});
