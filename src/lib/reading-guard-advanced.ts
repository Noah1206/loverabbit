// 고급 해석이 새는 것을 막는 검사.
//
// 이 층의 위험은 앞선 층과 종류가 다르다. P0/P1에서 막던 것은 "명식에 없는 글자를
// 말하는 것"이었고 그건 계산값과 대조하면 잡힌다. 여기서 막는 것은 **아직 아무도
// 승인하지 않은 판단을 사실처럼 말하는 것**이라, 문장만 보면 멀쩡하다.
//
//   "당신의 용신은 화예요"   — 계산값과 어긋나지 않는다. 근거도 있다.
//                              다만 그 근거가 draft 상태의 표에서 나왔다.
//
// 그래서 여기서는 문장에 쓰인 낱말과 advanced facts 의 승인 상태를 함께 본다.
// evidence_only 모드에서는 고급 낱말이 본문에 나오는 것 자체가 위반이다.

import type { GuardViolation } from "@/lib/reading-guard";
import type { StructuredReport } from "@/lib/reading-prompt";
import type { AdvancedMyeongriFacts } from "@/lib/myeongri/advanced-facts";
import { advancedReachesReader } from "@/lib/myeongri/advanced-mode";
import { canBackUserFacingClaim } from "@/lib/myeongri-policy/source-registry";
import { mayNameSingleYongsin } from "@/lib/myeongri/advanced-conflict";

/** 고급 해석에서만 쓰는 낱말 — 본문에 나오면 그 문장은 이 층을 밟은 것이다 */
const ADVANCED_TERMS = [
  "용신", "희신", "기신", "구신", "한신",
  "격국", "조후", "억부", "상신", "통관", "병약",
  "종격", "화기격", "건록격", "양인격",
];

/** 격 이름 — 십성 + 격 */
const GYEOKGUK_PATTERN =
  /(정관|편관|정재|편재|식신|상관|정인|편인|비견|겁재|건록|양인|종강|종왕|종아|종재|종살)격/g;

/** 용신을 확정한 꼴 */
const YONGSIN_ASSERTION =
  /(용신|희신|기신)(은|는|이|가)?\s*[가-힣]{0,4}(이에요|예요|입니다|이다|이야|다)/;

function bodyOf(report: StructuredReport): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: "meta.headline", text: report.meta.headline },
  ];
  report.sections.forEach((section, index) => {
    const parts = [section.verdict ?? "", section.summary, ...section.paragraphs, section.watchOut ?? ""];
    out.push({ where: `sections[${index}]`, text: parts.join(" ") });
  });
  report.summaryCards.forEach((card, index) => {
    out.push({ where: `summary_cards[${index}]`, text: `${card.value} ${card.detail}` });
  });
  return out.filter((x) => x.text);
}

export function checkAdvanced(
  report: StructuredReport,
  advanced: AdvancedMyeongriFacts | undefined
): GuardViolation[] {
  if (!advanced) return [];
  const out: GuardViolation[] = [];
  const add = (v: GuardViolation) => out.push(v);

  const reaches = advancedReachesReader(advanced.mode);
  // 규칙이 **돌았다**는 것과 그 규칙이 **문장을 허락한다**는 것은 다르다.
  //
  // CR-BOTH-WITH-SCOPE 는 승인돼 실제로 적용되지만, 그것이 허락하는 것은
  // "고르지 않는 것"이다. 이걸 허락 목록에 넣으면 정책 하나 승인한 순간
  // ADV-NO-SOURCE-TRACE 가 통째로 꺼진다.
  //
  // 허락은 출처가 한다. 쓸 수 있는 출처가 받치는 규칙만 문장을 열 수 있다.
  const licensingRuleIds = new Set(
    advanced.trace
      .filter(
        (t) =>
          t.verdict === "applied" &&
          t.sourceIds.length > 0 &&
          t.sourceIds.every(canBackUserFacingClaim)
      )
      .map((t) => t.ruleId)
  );
  const approvedGyeokguk =
    advanced.gyeokguk.determination === "determined" && advanced.gyeokguk.status === "approved"
      ? advanced.gyeokguk.primary?.pattern
      : null;
  // 충돌이 **처리됐다**는 것과 **단일 용신을 말해도 된다**는 것은 다른 말이다.
  // 승인된 정책(CR-BOTH-WITH-SCOPE)이 "고르지 않는다"이므로, 갈린 축이 있으면
  // policy_resolved 여도 단정은 여전히 막아야 한다. resolutionStatus 로 재면
  // 정책을 승인한 순간 이 검사가 통째로 꺼진다.
  const conflicted = !mayNameSingleYongsin(advanced.conflicts);

  for (const { where, text } of bodyOf(report)) {
    // "편인격" 에는 위 목록의 낱말이 하나도 없다. 격 이름 자체가 이 층을 밟은
    // 증거이므로 함께 센다 — 안 그러면 격 이름만 쓴 문장이 검사를 통째로 비껴간다.
    const namedPatterns = [...text.matchAll(GYEOKGUK_PATTERN)].map((m) => m[0]);
    const used = [...ADVANCED_TERMS.filter((term) => text.includes(term)), ...namedPatterns];

    // ── evidence_only 인데 고급 낱말이 본문에 있다 ──
    if (!reaches && used.length > 0) {
      add({
        kind: "명리",
        code: "ADV-POLICY-MODE-LEAK",
        where,
        blocking: true,
        detail: `${advanced.mode} 모드인데 고급 해석 용어(${used.join(", ")})가 본문에 있다 — 이 모드에서는 계산만 하고 글은 바꾸지 않는다`,
      });
      continue; // 이 모드에서는 아래 검사를 더 볼 것도 없다
    }
    if (used.length === 0) continue;

    // ── 승인된 trace 없이 고급 해석을 썼다 ──
    if (licensingRuleIds.size === 0) {
      add({
        kind: "명리",
        code: "ADV-NO-SOURCE-TRACE",
        where,
        blocking: true,
        detail: `고급 해석 용어(${used.join(", ")})를 썼는데 승인된 규칙·출처 trace가 하나도 없다`,
      });
    }

    // ── 축이 갈렸는데 결론을 단정했다 ──
    if (conflicted && YONGSIN_ASSERTION.test(text)) {
      add({
        kind: "명리",
        code: "ADV-CONFLICT-UNRESOLVED",
        where,
        blocking: true,
        detail:
          `축이 갈려 있는데(${advanced.conflicts.map((c) => c.subject).join(" / ")}) ` +
          `용신을 확정하는 문장을 썼다 — 승인된 정책은 고르지 않는 것이다`,
      });
    }

    // ── 후보를 확정처럼 말했다 ──
    if (YONGSIN_ASSERTION.test(text) && advanced.yongsin.finalOutput.status !== "policy_selected") {
      add({
        kind: "명리",
        code: "ADV-CANDIDATE-AS-FACT",
        where,
        blocking: true,
        detail: `용신이 ${advanced.yongsin.finalOutput.status} 인데 확정 표현으로 썼다`,
      });
    }

    // ── 모호한 격을 단일 격으로 불렀다 ──
    for (const match of text.matchAll(GYEOKGUK_PATTERN)) {
      const named = match[0];
      if (approvedGyeokguk === named) continue;
      add({
        kind: "명리",
        code: "ADV-UNSUPPORTED-GYEOKGUK",
        where,
        blocking: true,
        detail:
          advanced.gyeokguk.determination === "determined"
            ? `"${named}" — 격 후보는 섰지만 상태가 ${advanced.gyeokguk.status} 라 이름으로 부를 수 없다`
            : `"${named}" — 이 명식의 격은 ${advanced.gyeokguk.determination} 다`,
      });
    }

    // ── 승인되지 않은 출처로 결론을 만들었다 ──
    const usedSources = advanced.trace
      .filter((t) => licensingRuleIds.has(t.ruleId))
      .flatMap((t) => t.sourceIds);
    const bad = [...new Set(usedSources)].filter((id) => !canBackUserFacingClaim(id));
    if (bad.length > 0) {
      add({
        kind: "명리",
        code: "ADV-SOURCE-STATUS-INVALID",
        where,
        blocking: true,
        detail: `결론의 근거가 된 출처가 아직 쓸 수 없는 상태다 (${bad.join(", ")})`,
      });
    }
  }

  return out;
}

/** 배포를 막는 고급 코드 — reading-guard 의 DEPLOY_BLOCKING_CODES 가 합친다 */
export const ADVANCED_BLOCKING_CODES = [
  "ADV-NO-SOURCE-TRACE",
  "ADV-CONFLICT-UNRESOLVED",
  "ADV-UNSUPPORTED-GYEOKGUK",
  "ADV-CANDIDATE-AS-FACT",
  "ADV-POLICY-MODE-LEAK",
  "ADV-SOURCE-STATUS-INVALID",
] as const;
