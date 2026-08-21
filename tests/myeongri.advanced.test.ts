// 고급 해석 층 — 조후·격국·용신.
//
// 이 파일이 지키는 것은 두 가지다.
//   1) 계산은 재현된다 (계절·월령·후보)
//   2) **아무것도 사용자에게 안 나간다** — 그게 지금의 정상 상태다
//
// 2번이 더 중요하다. 이 층은 틀려도 드러나지 않아서, 새는 순간 아무도 모르게
// 새기 때문이다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeSaju } from "@/lib/saju";
import { buildSajuFacts } from "@/lib/saju-facts";
import { seasonalContext, isMonthTermName } from "@/lib/myeongri/seasonal-context";
import { assessGyeokguk, OUTER_PATTERN_NOTE } from "@/lib/myeongri/gyeokguk";
import { assessJohu } from "@/lib/myeongri/johu-assessment";
import { assessYongsin } from "@/lib/myeongri/yongsin";
import { buildAdvancedFacts, advancedForPrompt } from "@/lib/myeongri/advanced-facts";
import {
  detectConflicts,
  approvedResolutionPolicies,
  shouldSuppressAdvanced,
  mayNameSingleYongsin,
} from "@/lib/myeongri/advanced-conflict";
import { checkAdvanced } from "@/lib/reading-guard-advanced";
import { checkReport } from "@/lib/reading-guard";
import { matchRules } from "@/lib/reading-rules";
import { slimFacts, type StructuredReport } from "@/lib/reading-prompt";
import {
  MYEONGRI_SOURCES,
  canBackUserFacingClaim,
  ruleIsUserFacing,
  canTransition,
  blockersFor,
} from "@/lib/myeongri-policy/source-registry";
import {
  FIXTURE_INPUTS,
  REVIEWED_FIXTURES,
  fixtureReviewSummary,
} from "@/lib/myeongri-policy/advanced-fixtures";
import { buildPolicyBoard } from "@/lib/myeongri-policy/policy-board";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const BIRTH = { year: 1993, month: 1, day: 24, hour: 14 } as const;
const CHART = computeSaju(BIRTH);
const ME = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
const PARTNER = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" }, NOW);

// ── 1. 출처 레지스트리 ────────────────────────────────────

describe("출처 없이는 결론이 못 나간다", () => {
  it("등록된 출처가 전부 metadata_only 거나 internal 이다", () => {
    // 이 저장소에 어떤 판본의 원문도 들어 있지 않다. 그것이 지금의 사실이다.
    const usable = MYEONGRI_SOURCES.filter((s) => canBackUserFacingClaim(s.sourceId));
    assert.deepEqual(usable, [], `결론 근거로 쓸 수 있는 출처가 생겼다: ${usable.map((s) => s.sourceId)}`);
  });

  it("고전 출처는 판본과 위치가 아직 미확정이다", () => {
    for (const source of MYEONGRI_SOURCES.filter((s) => s.sourceType === "classical_text")) {
      assert.ok(source.edition.includes("미확정"), `${source.sourceId}: 판본이 확정된 것처럼 적혀 있다`);
      assert.equal(source.excerpt, undefined, `${source.sourceId}: 권리 확인 전인데 발췌가 들어 있다`);
    }
  });

  it("approved 라도 출처가 못 받치면 사용자에게 못 간다", () => {
    const rule = {
      ruleId: "TEST",
      family: "johu" as const,
      status: "approved" as const,
      sourceIds: ["SRC-GUNGTONG"],
      applicability: "",
      requiredFacts: [],
      output: {},
      safePhrasing: [],
      forbiddenPhrasing: [],
      policyVersion: "test",
    };
    assert.equal(ruleIsUserFacing(rule), false);
    assert.ok(blockersFor(rule).some((b) => b.includes("metadata_only")));
  });

  it("상태 전이는 건너뛸 수 없다", () => {
    assert.equal(canTransition("draft", "approved"), false);
    assert.equal(canTransition("draft", "source_attached"), true);
    assert.equal(canTransition("reviewed", "approved"), true);
    assert.equal(canTransition("approved", "draft"), false);
  });
});

// ── 2. 계절 맥락 (계산층) ──────────────────────────────────

describe("계절 맥락은 재현된다", () => {
  it("기준 명식은 소한 구간의 축월이다", () => {
    const context = seasonalContext(CHART);
    assert.equal(context.monthBranch, "축");
    assert.equal(context.solarTermWindow.birthSolarTerm, "소한");
    assert.ok(isMonthTermName(context.solarTermWindow.birthSolarTerm));
    assert.equal(context.solarTermWindow.season, "transition");
    assert.equal(context.climateAxes.temperature, "cold");
    assert.equal(context.climateAxes.moisture, "wet");
  });

  it("절입에서 얼마나 지났는지 센다", () => {
    const context = seasonalContext(CHART);
    assert.ok(context.solarTermWindow.daysIntoTerm >= 0);
    assert.ok(context.solarTermWindow.daysIntoTerm < 32);
    // 소한(1/5)에서 1/24 까지는 보름이 넘으므로 경계가 아니다
    assert.equal(context.solarTermWindow.beforeOrAfterTerm, undefined);
  });

  it("절입 가까이에 태어나면 경계로 표시한다", () => {
    const edge = seasonalContext(computeSaju({ year: 1987, month: 8, day: 8, hour: 9 }));
    assert.ok(edge.solarTermWindow.beforeOrAfterTerm);
  });

  it("사계(진술축미)의 온습이 서로 다르다", () => {
    // 넷을 balanced 로 묶으면 조후가 가장 필요한 두 자리(축·미)가 사라진다.
    const of = (m: number, d: number) => seasonalContext(computeSaju({ year: 2000, month: m, day: d, hour: 12 }));
    assert.equal(of(1, 20).climateAxes.temperature, "cold"); // 축
    assert.equal(of(7, 20).climateAxes.temperature, "hot"); // 미
    assert.equal(of(4, 20).climateAxes.moisture, "wet"); // 진
    assert.equal(of(10, 20).climateAxes.moisture, "dry"); // 술
  });

  it("근거에 출처가 붙어 있다", () => {
    for (const e of seasonalContext(CHART).evidence) {
      assert.equal(e.source, "SRC-INTERNAL-CLIMATE");
    }
  });
});

// ── 3. 격국 V1 ───────────────────────────────────────────

describe("격국은 월지에서 서고, 모르면 모른다고 한다", () => {
  it("월령의 지장간과 십성을 낸다", () => {
    const g = assessGyeokguk(CHART);
    assert.equal(g.monthlyCommand.branch, "축");
    assert.deepEqual(
      g.monthlyCommand.hiddenStems.map((h) => h.stem),
      ["기", "신", "계"]
    );
    assert.deepEqual(g.monthlyCommand.tenGodsToDayMaster, ["편재", "편관", "편인"]);
  });

  it("투간을 찾는다 — 계수가 월간·시간에 드러나 있다", () => {
    const g = assessGyeokguk(CHART);
    const gye = g.monthlyCommand.exposed.find((e) => e.stem === "계");
    assert.ok(gye, "계수 투간이 안 잡혔다");
    assert.deepEqual(gye!.atPositions, ["월간", "시간"]);
  });

  it("월지가 충을 맞으면 흔들림으로 잡는다", () => {
    const g = assessGyeokguk(CHART);
    assert.ok(g.monthlyCommand.disturbed.some((d) => d.kind === "충" && d.with === "미"));
  });

  it("승인된 순서로 대표를 고른다 — 월령 투간 우선", () => {
    // 2026-08-21 이전에는 후보가 둘이면 무조건 ambiguous 였다. 32건 중 16건이 그랬는데
    // 그 절반은 동률이라서가 아니라 고를 규칙이 없어서였다.
    const g = assessGyeokguk(CHART);
    assert.equal(g.determination, "determined");
    assert.equal(g.primary?.pattern, "편재격", "월지 축의 본기 기토가 대표여야 한다");
    assert.ok(g.candidates.length >= 2, "다른 후보도 함께 남아 있어야 한다");
  });

  it("본기가 비겁이면 건너뛰고 투간한 것을 본다", () => {
    // 갑인월 을목: 본기 갑이 겁재라 격이 안 선다. 그때 투간 우선이 막히면 안 된다.
    const g = assessGyeokguk(computeSaju({ year: 1988, month: 2, day: 20, hour: 10 }));
    assert.equal(g.determination, "determined");
    assert.equal(g.primary?.family, "inner");
  });

  it("정할 수 없는 자리는 여전히 ambiguous 다", () => {
    // 순서를 세웠다고 모든 명식이 정해지는 것은 아니다. 본기가 비겁이고 투간도 없으면
    // 남는 것은 중기·여기뿐이라 근거가 얇다.
    const thin = assessGyeokguk(computeSaju({ year: 1992, month: 5, day: 10, hour: 23 }));
    assert.equal(thin.determination, "ambiguous");
    assert.equal(thin.primary, null);
  });

  it("월지가 충을 맞아도 판정이 뒤집히지 않는다", () => {
    // 충은 격이 손상됐다는 뜻이지 어느 격인지 모른다는 뜻이 아니다.
    const g = assessGyeokguk(CHART);
    assert.ok(g.monthlyCommand.disturbed.some((d) => d.kind === "충"));
    assert.equal(g.determination, "determined");
    assert.equal(g.primary?.confidence, "low", "충을 맞았으면 무게는 낮아져야 한다");
  });

  it("외격·종격·화기격은 V1에서 판정하지 않는다", () => {
    const g = assessGyeokguk(CHART);
    assert.ok(g.exclusions.some((x) => x.pattern.includes("종격")));
    assert.equal(OUTER_PATTERN_NOTE.status, "unsupported");
    // 어떤 명식에서도 내격 아닌 후보가 서면 안 된다.
    for (const input of FIXTURE_INPUTS) {
      const chart = computeSaju(input.birthInput);
      for (const candidate of assessGyeokguk(chart).candidates) {
        assert.equal(candidate.family, "inner", `${input.id}: 내격 아닌 후보가 섰다`);
      }
    }
  });

  it("순서는 승인됐지만 격 이름은 아직 사용자에게 못 나간다", () => {
    // 후보 사이의 순서와, 그 이름을 불러도 되는지는 다른 물음이다.
    // SRC-JAPYEONG 이 metadata_only 인 동안 뒤쪽은 막혀 있다.
    assert.equal(assessGyeokguk(CHART).status, "source_attached");
  });

  it("상신과 순역은 표가 없어 비어 있다", () => {
    assert.deepEqual(ME.advanced.sangshin, []);
    assert.equal(ME.advanced.gyeokOperation.operation, "unknown");
    assert.equal(ME.advanced.gyeokOperation.status, "blocked");
  });
});

// ── 4. 조후 후보 ─────────────────────────────────────────

describe("조후 후보는 계산되지만 승인 전이다", () => {
  it("축월 한랭에서 화·목 후보가 선다", () => {
    const johu = assessJohu(CHART);
    const primary = johu.candidates.filter((c) => c.priority === "primary");
    assert.deepEqual(primary.map((c) => c.candidateElement), ["화"]);
    assert.ok(johu.candidates.some((c) => c.candidateElement === "목"));
  });

  it("승인된 후보가 하나도 없다", () => {
    const johu = assessJohu(CHART);
    assert.deepEqual(johu.appliedCandidates, []);
    assert.ok(johu.candidates.every((c) => c.status === "candidate"));
  });

  it("막고 있는 것이 무엇인지 후보마다 적혀 있다", () => {
    for (const c of assessJohu(CHART).candidates) {
      assert.ok(c.blockers.length > 0, `${c.ruleId}: 왜 못 나가는지가 없다`);
      assert.ok(c.blockers.some((b) => b.includes("metadata_only")));
    }
  });

  it("후보마다 금지 어법이 붙어 있다", () => {
    for (const c of assessJohu(CHART).candidates) {
      assert.ok(c.forbiddenPhrasing.length > 0, `${c.ruleId}: 금지선이 없다`);
    }
  });

  it("그 오행이 명식 안에 있는지 함께 낸다", () => {
    const johu = assessJohu(CHART);
    // 기준 명식에는 일지 사화가 있다.
    assert.equal(johu.candidates.find((c) => c.candidateElement === "화")!.presentInChart, true);
  });
});

// ── 5. 용신 다축 ─────────────────────────────────────────

describe("용신은 하나로 고르지 않는다", () => {
  it("축마다 따로 후보를 낸다", () => {
    const y = assessYongsin(CHART, "신약");
    assert.ok(y.candidatesByAxis.eokbu.length > 0);
    assert.ok(y.candidatesByAxis.johu.length > 0);
  });

  it("통관·병약은 V2라 not_applicable 이다", () => {
    const y = assessYongsin(CHART, "신약");
    for (const axis of ["tonggwan", "byeongyak"] as const) {
      assert.ok(y.candidatesByAxis[axis].every((c) => c.status === "not_applicable"));
      assert.ok(y.candidatesByAxis[axis].every((c) => c.element === null));
    }
  });

  it("오행을 정할 수 없는 후보는 비워 둔다 — 자리를 채우지 않는다", () => {
    const y = assessYongsin(CHART, "신약");
    for (const list of Object.values(y.candidatesByAxis)) {
      for (const c of list) {
        if (c.status === "blocked" || c.status === "not_applicable") {
          assert.equal(c.element, null, `${c.ruleId}: 못 정하는데 오행이 채워져 있다`);
        }
      }
    }
  });

  it("기준 명식은 억부와 조후가 갈린다", () => {
    const y = assessYongsin(CHART, "신약");
    assert.equal(y.consensus.kind, "conflict");
    assert.ok(y.consensus.elements.includes("수"));
    assert.ok(y.consensus.elements.includes("화"));
  });

  it("어떤 경우에도 최종 용신이 선택되지 않는다", () => {
    for (const input of FIXTURE_INPUTS) {
      const chart = computeSaju(input.birthInput);
      const facts = buildSajuFacts(input.birthInput, NOW);
      const y = assessYongsin(chart, facts.strength.label);
      assert.notEqual(y.finalOutput.status, "policy_selected", `${input.id}: 용신이 확정됐다`);
      assert.equal(y.finalOutput.selected, undefined);
    }
  });
});

// ── 6. 충돌 ──────────────────────────────────────────────

describe("축이 갈리면 고르지 않는다", () => {
  it("승인된 정책은 '고르지 않는다' 하나뿐이다", () => {
    const approved = approvedResolutionPolicies();
    assert.equal(approved.length, 1);
    assert.equal(approved[0].policyId, "CR-BOTH-WITH-SCOPE");
    // 누가 이기는지를 정한 정책들은 여전히 draft 다 — 판본이 있어야 열린다.
    assert.equal(approved.some((p) => p.priorityOrder.length > 0), false);
  });

  it("기준 명식의 충돌은 정책으로 처리되되 승자가 없다", () => {
    const conflicts = ME.advanced.conflicts;
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].resolutionStatus, "policy_resolved");
    assert.equal(conflicts[0].resolutionPolicyId, "CR-BOTH-WITH-SCOPE");
    assert.deepEqual(conflicts[0].axes, ["eokbu", "johu"]);
    assert.ok(conflicts[0].explanation.includes("고르지 않는다"));
  });

  it("처리됐다고 해서 단정해도 되는 것은 아니다", () => {
    // 이 둘을 같은 값으로 재면, 정책을 승인한 순간 단정 검사가 통째로 꺼진다.
    assert.equal(shouldSuppressAdvanced(ME.advanced.conflicts), false);
    assert.equal(mayNameSingleYongsin(ME.advanced.conflicts), false);
  });

  it("충돌이 없으면 억지로 만들지 않는다", () => {
    const y = assessYongsin(CHART, "신약");
    // 축이 하나만 살아 있는 상태를 흉내 낸다
    const single = { ...y, candidatesByAxis: { ...y.candidatesByAxis, johu: [] } };
    assert.deepEqual(detectConflicts(single, ME.advanced.seasonalContext), []);
  });

  it("합의한 명식에서는 충돌이 안 잡힌다", () => {
    // 표본 전체에서 consensus 와 conflicts 가 어긋나면 안 된다.
    for (const input of FIXTURE_INPUTS) {
      const facts = buildSajuFacts(input.birthInput, NOW);
      const a = facts.advanced;
      if (a.yongsin.consensus.kind === "conflict") {
        assert.ok(a.conflicts.length > 0, `${input.id}: 갈렸다는데 충돌이 없다`);
      } else {
        assert.equal(a.conflicts.length, 0, `${input.id}: 합의했다는데 충돌이 잡혔다`);
      }
    }
  });
});

// ── 7. 기본값에서 아무것도 안 나간다 ─────────────────────────

describe("evidence_only 에서는 사용자 글이 바뀌지 않는다", () => {
  it("기본 모드가 evidence_only 다", () => {
    assert.equal(ME.advanced.mode, "evidence_only");
    assert.equal(ME.advanced.readerVisible, false);
  });

  it("프롬프트 입력에 advanced 가 실리지 않는다", () => {
    assert.equal(advancedForPrompt(ME.advanced), null);
    assert.equal("advanced" in (slimFacts(ME) as Record<string, unknown>), false);
  });

  it("고급 층이 강약 라벨을 건드리지 않는다", () => {
    // 강약은 P2 표가 정한다. 고급 층(조후·격국·용신)은 그 값을 읽기만 한다.
    const before = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW).strength;
    for (const mode of ["policy_preview", "policy_enabled"] as const) {
      process.env.ADVANCED_MYEONGRI_MODE = mode;
      const after = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW).strength;
      delete process.env.ADVANCED_MYEONGRI_MODE;
      assert.equal(after.label, before.label, `${mode}: 고급 모드가 강약을 바꿨다`);
      assert.equal(after.score, before.score, `${mode}: 고급 모드가 강약을 바꿨다`);
    }
  });

  it("모드를 올려도 승인이 없으면 여전히 안 나간다", () => {
    for (const mode of ["policy_preview", "policy_enabled"] as const) {
      const advanced = buildAdvancedFacts(CHART, "신약", mode);
      assert.equal(advanced.readerVisible, false, `${mode}: 승인 없이 문이 열렸다`);
      assert.ok(advanced.suppressionReasons.length > 0);
      assert.equal(advancedForPrompt(advanced), null);
    }
  });

  it("왜 안 나가는지가 적혀 있다", () => {
    const reasons = ME.advanced.suppressionReasons.join(" ");
    assert.ok(reasons.includes("evidence_only"));
    assert.ok(reasons.includes("조후"));
    assert.ok(reasons.includes("CR-BOTH-WITH-SCOPE"));
  });

  it("사용자 글을 허락하는 규칙이 하나도 없다", () => {
    // 돌아간 규칙은 있다 — 충돌 정책은 승인돼 실제로 적용된다. 다만 그것이 허락하는
    // 것은 "고르지 않는 것"이라 문장을 열지 않는다. 문장을 여는 것은 쓸 수 있는 출처다.
    const licensing = ME.advanced.trace.filter(
      (t) => t.verdict === "applied" && t.sourceIds.length > 0 && t.sourceIds.every(canBackUserFacingClaim)
    );
    assert.deepEqual(licensing, [], `허락된 규칙이 생겼다: ${licensing.map((t) => t.ruleId)}`);
    assert.ok(ME.advanced.trace.length > 0, "계산은 했는데 흔적이 없다");
  });
});

// ── 8. 가드 ──────────────────────────────────────────────

function reportSaying(text: string): StructuredReport {
  return {
    meta: { title: "t", headline: "헤드라인은 스무 자를 넘겨야 검사에 안 걸려요", readingTimeMin: 8, disclaimer: "", confidenceNote: "" },
    summaryCards: [],
    sections: [
      {
        id: "core",
        navLabel: "결",
        title: "지금 두 사람 사이에 무엇이 걸려 있는지",
        summary: text,
        paragraphs: ["문단."],
        factsUsed: [],
        ruleIds: [],
      },
    ],
    actionQuestions: [
      { question: "q1", whyItMatters: "w1" },
      { question: "q2", whyItMatters: "w2" },
      { question: "q3", whyItMatters: "w3" },
    ],
    characterNote: null,
    nextStep: null,
  };
}

const codes = (text: string) => checkAdvanced(reportSaying(text), ME.advanced).map((v) => v.code);

describe("고급 해석이 새면 막는다", () => {
  it("evidence_only 에서 고급 용어가 본문에 있으면 막힌다", () => {
    assert.ok(codes("당신의 조후를 보면 온기가 필요해요").includes("ADV-POLICY-MODE-LEAK"));
    assert.ok(codes("용신은 화예요").includes("ADV-POLICY-MODE-LEAK"));
    assert.ok(codes("이 명식은 편재격이에요").includes("ADV-POLICY-MODE-LEAK"));
  });

  it("고급 용어를 안 쓰면 아무것도 안 걸린다", () => {
    assert.deepEqual(codes("가까울수록 같은 대목에 걸리는 자리예요"), []);
  });

  it("모드를 올려도 승인 없으면 다른 코드로 막힌다", () => {
    const preview = buildAdvancedFacts(CHART, "신약", "policy_preview");
    const found = checkAdvanced(reportSaying("당신의 용신은 화예요"), preview).map((v) => v.code);
    assert.ok(found.includes("ADV-NO-SOURCE-TRACE"), found.join(", "));
    assert.ok(found.includes("ADV-CONFLICT-UNRESOLVED"), found.join(", "));
    assert.ok(found.includes("ADV-CANDIDATE-AS-FACT"), found.join(", "));
  });

  it("모호한 격을 이름으로 부르면 막힌다", () => {
    const preview = buildAdvancedFacts(CHART, "신약", "policy_preview");
    const found = checkAdvanced(reportSaying("구조로 보면 편인격에 가까워요"), preview).map((v) => v.code);
    assert.ok(found.includes("ADV-UNSUPPORTED-GYEOKGUK"), found.join(", "));
  });

  it("고급 코드가 배포 차단 목록에 들어 있다", () => {
    const report = reportSaying("용신은 화예요");
    const result = checkReport(report, {
      expectedSections: 1,
      facts: ME,
      partnerFacts: PARTNER,
      matchedRules: matchRules(ME, PARTNER, "jaehoe", 15),
      productDomain: "jaehoe",
    });
    assert.equal(result.needsReview, true);
    assert.equal(result.mustRetry, true);
  });

  it("명식을 안 주면 고급 검사도 안 돈다", () => {
    const result = checkReport(reportSaying("용신은 화예요"), { expectedSections: 1 });
    assert.equal(result.violations.some((v) => v.code?.startsWith("ADV-")), false);
  });
});

// ── 9. 회귀 세트와 관리 화면 ────────────────────────────────

describe("회귀 세트", () => {
  it("서른 건 이상이다", () => {
    assert.ok(FIXTURE_INPUTS.length >= 30, `${FIXTURE_INPUTS.length}건뿐이다`);
  });

  it("열두 월지를 다 밟는다", () => {
    const branches = new Set(
      FIXTURE_INPUTS.map((f) =>
        seasonalContext(computeSaju(f.birthInput)).monthBranch
      )
    );
    assert.equal(branches.size, 12, `월지 ${branches.size}종만 밟는다`);
  });

  it("격국 판정 세 상태를 다 밟는다", () => {
    const states = new Set(
      FIXTURE_INPUTS.map(
        (f) => assessGyeokguk(computeSaju(f.birthInput)).determination
      )
    );
    for (const s of ["determined", "ambiguous", "unsupported"]) {
      assert.ok(states.has(s as never), `${s} 를 밟는 명식이 없다`);
    }
  });

  it("계산 칸은 서른두 건 다 받아 적혔다", () => {
    const summary = fixtureReviewSummary();
    assert.equal(summary.computationReviewed, FIXTURE_INPUTS.length);
    assert.equal(REVIEWED_FIXTURES.length, FIXTURE_INPUTS.length);
  });

  it("판단 칸은 지어내지 않았다 — 그래서 policy_enabled 가 막혀 있다", () => {
    const summary = fixtureReviewSummary();
    assert.equal(summary.reviewed, 0, "전문가 검토 없이 reviewed 가 생겼다");
    assert.equal(summary.gatesPolicyEnabled, true);
    for (const f of REVIEWED_FIXTURES) {
      assert.deepEqual(f.approvedPolicyAssertions, [], `${f.id}: 판단 칸이 채워져 있다`);
    }
  });

  it("받아 적은 계산값이 지금 계산과 같다 — 이게 자물쇠다", () => {
    for (const f of REVIEWED_FIXTURES) {
      const facts = buildSajuFacts(f.birthInput, NOW);
      const p = facts.fourPillars;
      const a = facts.advanced;
      assert.equal(`${p.year.stem}${p.year.branch}`, f.expectedFourPillars.year, `${f.id}: 연주`);
      assert.equal(`${p.month.stem}${p.month.branch}`, f.expectedFourPillars.month, `${f.id}: 월주`);
      assert.equal(`${p.day.stem}${p.day.branch}`, f.expectedFourPillars.day, `${f.id}: 일주`);
      assert.equal(
        p.hour ? `${p.hour.stem}${p.hour.branch}` : null,
        f.expectedFourPillars.hour,
        `${f.id}: 시주`
      );
      assert.equal(a.seasonalContext.monthBranch, f.expectedSeasonalContext.monthBranch, `${f.id}: 월지`);
      assert.equal(a.seasonalContext.solarTermWindow.season, f.expectedSeasonalContext.season, `${f.id}: 계절`);
      assert.equal(
        a.seasonalContext.climateAxes.temperature,
        f.expectedSeasonalContext.temperature,
        `${f.id}: 한난`
      );
      assert.equal(
        a.seasonalContext.climateAxes.moisture,
        f.expectedSeasonalContext.moisture,
        `${f.id}: 조습`
      );
      assert.equal(a.gyeokguk.determination, f.expectedGyeokgukStatus, `${f.id}: 격국 판정`);
      assert.equal(a.yongsin.consensus.kind, f.expectedConflictKind, `${f.id}: 축 합의`);
    }
  });

  it("모든 명식에서 고급 해석이 사용자에게 안 나간다", () => {
    for (const input of FIXTURE_INPUTS) {
      const facts = buildSajuFacts(input.birthInput, NOW);
      assert.equal(facts.advanced.readerVisible, false, `${input.id}: 문이 열렸다`);
      assert.equal(advancedForPrompt(facts.advanced), null, `${input.id}: 모델에게 갔다`);
    }
  });

  it("시각 미상 명식도 깨지지 않는다", () => {
    const unknown = FIXTURE_INPUTS.find((f) => f.birthInput.hour === null)!;
    const facts = buildSajuFacts(unknown.birthInput, NOW);
    assert.equal(facts.fourPillars.hour, null);
    assert.ok(facts.advanced.seasonalContext.monthBranch);
  });
});

describe("관리 화면", () => {
  it("모드와 승인 순서를 낸다", () => {
    const board = buildPolicyBoard(NOW);
    assert.equal(board.mode, "evidence_only");
    assert.equal(board.approvalOrder.length, 6);
    assert.equal(board.approvalOrder[0].done, true, "계절 계산은 이미 확정된 층이다");
  });

  it("승인이 필요한 것이 아직 남아 있다고 말한다", () => {
    const board = buildPolicyBoard(NOW);
    const done = board.approvalOrder.filter((s) => s.done).length;
    assert.ok(done < board.approvalOrder.length, "다 승인됐다고 나온다");
  });

  it("출처마다 쓸 수 있는지 표시한다", () => {
    const board = buildPolicyBoard(NOW);
    assert.ok(board.sources.every((s) => s.usable === false));
  });

  it("기준 명식 상태를 함께 보여 준다", () => {
    const board = buildPolicyBoard(NOW);
    assert.ok(board.sample);
    assert.equal(board.sample!.fourPillars, "임신 계축 을사 계미");
    assert.equal(board.sample!.advanced.conflicts.length, 1);
  });
});
