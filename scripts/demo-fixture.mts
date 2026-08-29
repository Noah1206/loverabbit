// 데모 리포트 만들기 — 생성해서 곧바로 src/content/demo/ 에 넣는다.
//
// reading-preview.mts 는 .reading-preview.*.json 에 남기는데 그건 gitignore 대상이다
// (유료 본문이 들어 있어서). 데모로 쓰려면 커밋 가능한 자리로 옮겨야 하고, 그
// 옮기는 일을 손으로 하면 언젠가 빠뜨린다.
//
//   npm run demo:fixture -- --product yeonae
//
// 실패하거나 절이 모자라면 빈 파일을 남기지 않는다 — 반쯤 만들어진 데모가
// 커밋되면 그게 사용자에게 나간다.

import { writeFileSync, readFileSync, existsSync } from "node:fs";

import { buildSajuFacts } from "../src/lib/saju-facts";
import { composeReport } from "../src/lib/reading-compose";
import { matchRules, forbiddenFromRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { checkReport } from "../src/lib/reading-guard";
import { chatComplete } from "../src/lib/ai";
import { PRODUCTS } from "../src/lib/products";
import { DEMO_SLOTS } from "../src/lib/reading-demo";

const args = process.argv.slice(2);
const argOf = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : null;
};

const PRODUCT_ID = argOf("product");
if (!PRODUCT_ID) {
  console.error(`--product 를 주세요. 데모가 필요한 상품: ${DEMO_SLOTS.join(", ")}`);
  process.exit(1);
}

const product = PRODUCTS.find((p) => p.id === PRODUCT_ID);
if (!product) {
  console.error(`상품 ${PRODUCT_ID} 를 못 찾았어요.`);
  process.exit(1);
}

// 데모에 쓰는 명식. 늘 같은 것을 써야 상품끼리 견줘 볼 수 있다.
const SUBJECT = { year: 1993, month: 1, day: 24, hour: 14, gender: "F" as const };
const PARTNER = { year: 1991, month: 7, day: 8, hour: 20, gender: "M" as const };

const me = buildSajuFacts(SUBJECT);
const partner = buildSajuFacts(PARTNER);
const rules = matchRules(me, partner, PRODUCT_ID, Math.max(12, product.toc.length));
const scoped = scopeOutline({ product: PRODUCT_ID, outline: product.toc, facts: me, matchedRules: rules });

console.log(`상품 : ${product.title} (${PRODUCT_ID}) · 목차 ${scoped.outline.length}절 · 규칙 ${rules.length}개`);
for (const note of scoped.notes) console.log(`범위 : ${note}`);

const composed = await composeReport(
  {
    facts: me,
    partnerFacts: partner,
    matchedRules: rules,
    productLabel: product.promptLabel,
    productId: PRODUCT_ID,
    outline: scoped.outline,
    focus: "relationship",
    currentScene: "",
    occupation: undefined,
    now: new Date(),
  },
  (system, user, budget, callOptions) =>
    chatComplete(system, [{ role: "user", content: user }], budget, {
      thinking: false,
      json: true,
      ...callOptions,
    })
);

if (!composed.report) {
  console.error(`\n만들지 못했어요: ${composed.failedParts.join(", ") || "불명"}`);
  console.error("빈 파일은 남기지 않습니다.");
  process.exit(1);
}

const report = composed.report;
if (report.sections.length < scoped.outline.length) {
  console.error(`\n절이 모자랍니다 (${report.sections.length}/${scoped.outline.length}). 반쪽짜리 데모는 남기지 않습니다.`);
  process.exit(1);
}

const guard = checkReport(report, {
  expectedSections: scoped.outline.length,
  forbiddenClaims: forbiddenFromRules(rules),
  facts: me,
  partnerFacts: partner,
  matchedRules: rules,
  productDomain: PRODUCT_ID,
});

const path = `src/content/demo/${PRODUCT_ID}.json`;
const previous = existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
writeFileSync(path, `${JSON.stringify({ ready: true, report }, null, 2)}\n`, "utf-8");

console.log(`\n글 완료 · ${report.sections.length}/${scoped.outline.length}절`);
console.log(`검수 · 위반 ${guard.violations.length}건 (막는 것 ${guard.violations.filter((v) => v.blocking).length}) · needsReview=${guard.needsReview}`);
for (const v of guard.violations.filter((x) => x.blocking).slice(0, 6)) {
  console.log(`   [${v.code ?? v.kind}] ${v.where} ${v.detail.slice(0, 100)}`);
}
console.log(`\n${path} 에 넣었어요${previous?.ready ? " (앞의 것을 덮어썼습니다)" : ""}.`);
console.log("데모로 쓰려면 READING_DEMO_MODE=on 이면 됩니다. 등록은 자동이에요.");
