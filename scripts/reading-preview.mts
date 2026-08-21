// 리딩 한 건을 실제로 만들어 .reading-preview.json 에 남긴다.
// /dev/reading-preview 가 그걸 읽어 실제 결과 페이지 디자인으로 보여준다.
//
//   npm run reading:preview -- --product jaehoe            글만
//   npm run reading:preview -- --product jaehoe --images   글 + 삽화
//
// **--env-file 은 .env.local 을 먼저 읽어야 한다.** GEMINI_API_KEY 가 거기 있는데
// .env 만 읽으면 그 키를 못 보고 키 우선순위가 유료 제공사로 떨어진다. 실제로 그렇게
// OpenAI 잔액이 나갔다. npm 스크립트를 쓰면 이 순서가 이미 박혀 있다.
// 확실히 하려면 AI_PROVIDER=gemini 로 못 박는다.
//   글이 이미 있으면 --images 는 그림만 만든다. 글부터 다시 하려면 --force.
//   --product ibyeol / --job "프리랜서 디자이너" 로 조건을 바꾼다.
//
// 생성에는 실비가 든다. 그래서 이미 있는 결과를 함부로 다시 만들지 않는다.

import fs from "node:fs";
import { buildSajuFacts } from "../src/lib/saju-facts";
import { composeReport } from "../src/lib/reading-compose";
import { matchRules, forbiddenFromRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { checkReport } from "../src/lib/reading-guard";
import { reportToText, type StructuredReport } from "../src/lib/reading-prompt";
import { chatComplete } from "../src/lib/ai";
import { PRODUCTS } from "../src/lib/products";
import { buildChapters, reportPieces } from "../src/lib/reading-chapters";
import { conceptFor } from "../src/lib/reading-concepts";
import { renderImage, writeImagePrompts, pickIllustrated, TALISMAN_SLOT } from "../src/lib/reading-images";
import { planTalisman } from "../src/lib/reading-talisman";

const args = process.argv.slice(2);
const argOf = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const PRODUCT_ID = argOf("product") ?? "jaehoe";
const SUBJECT = { year: 1993, month: 1, day: 24, hour: 14, gender: "F" as const };
const PARTNER = { year: 1991, month: 7, day: 8, hour: 20, gender: "M" as const };
const QUESTION = "헤어진 지 넉 달인데 아직 가끔 연락이 와요. 같은 이유로 또 싸울까 봐 겁나요.";
// 직업은 계산에 안 들어간다. 장면이 실제로 달라지는지 눈으로 보려고 넣어 둔다.
const OCCUPATION = argOf("job") ?? "3교대 간호사";

// 상품마다 따로 남긴다. 하나로 두면 속궁합을 뽑는 순간 재회가 사라져서
// 두 상품을 나란히 볼 수 없다.
const OUT = `.reading-preview.${PRODUCT_ID}.json`;

const product = PRODUCTS.find((p) => p.id === PRODUCT_ID);
if (!product) {
  console.error(`상품 ${PRODUCT_ID} 를 못 찾았어요. 가능한 값: ${PRODUCTS.map((p) => p.id).join(", ")}`);
  process.exit(1);
}

// 글은 있는데 그림만 더 만들고 싶은 경우가 있다. 그때 본문을 다시 만들면
// 돈이 두 번 나가고, 화면에 이미 뜬 글까지 바뀐다.
const reuseText = fs.existsSync(OUT) && !has("force");
if (reuseText && !has("images")) {
  console.log(`${OUT} 이 이미 있어요. 글부터 다시 만들려면 --force, 그림만 만들려면 --images.`);
  process.exit(0);
}

const me = buildSajuFacts(SUBJECT);
const partner = buildSajuFacts(PARTNER);
const rules = matchRules(me, partner, PRODUCT_ID, Math.max(12, product.toc.length));
const scoped = scopeOutline({ product: PRODUCT_ID, outline: product.toc, facts: me, matchedRules: rules });
const pillars = (f: typeof me) =>
  [f.fourPillars.year, f.fourPillars.month, f.fourPillars.day, f.fourPillars.hour]
    .map((p) => (p ? p.stem + p.branch : "—"))
    .join(" ");

const readingId = `preview-${PRODUCT_ID}`;

interface Saved {
  entry: { readingId: string; teaser: string; full: string };
  report: StructuredReport;
}

let report: StructuredReport;
let teaser: string;
let full: string;

if (reuseText) {
  console.log("이미 만든 글을 그대로 씁니다 — 그림만 만들어요.");
  const saved = JSON.parse(fs.readFileSync(OUT, "utf8")) as Saved;
  report = saved.report;
  teaser = saved.entry.teaser;
  full = saved.entry.full;
} else {
  console.log(`상품 : ${product.title} (${PRODUCT_ID}) · 목차 ${scoped.outline.length}절`);
  for (const note of scoped.notes) console.log(`범위 : ${note}`);
  for (const item of scoped.dropped) console.log(`제외 : ${item}`);
  console.log(`명식 : ${pillars(me)}`);
  console.log(`상대 : ${pillars(partner)}`);
  console.log(`원국의 형: ${me.xing.map((x) => `${x.kind}/${x.completeness}`).join(" | ") || "없음"}`);
  console.log(`운의 형  : ${me.xingLuck.map((x) => `${x.kind}/${x.completeness}`).join(" | ") || "없음"}`);
  console.log(`규칙 : ${rules.map((r) => r.id).join(" ")}`);
  console.log(`하는 일: ${OCCUPATION || "(안 적음)"}`);
  console.log("");
  console.log("글을 만드는 중… (40초쯤 걸려요)");

  const t0 = Date.now();
  const composed = await composeReport(
    {
      facts: me,
      partnerFacts: partner,
      matchedRules: rules,
      productLabel: product.promptLabel,
      outline: scoped.outline,
      focus: "relationship",
      currentScene: QUESTION,
      occupation: OCCUPATION,
      characterId: null,
      characterName: null,
      now: new Date(),
    },
    (system: string, user: string, budget: number) =>
      chatComplete(system, [{ role: "user", content: user }], budget, { thinking: false, json: true })
  );
  const ms = Date.now() - t0;

  if (!composed.report) {
    console.error("리포트를 만들지 못했어요:", composed.failedParts.join(", "));
    process.exit(1);
  }
  report = composed.report;
  ({ teaser, full } = reportToText(report));

  const guard = checkReport(report, {
    expectedSections: scoped.outline.length,
    forbiddenClaims: forbiddenFromRules(rules),
    facts: me,
    partnerFacts: partner,
    matchedRules: rules,
    productDomain: PRODUCT_ID,
  });
  if (guard.needsReview) {
    console.log("검수 : needs_review — 이 상태로는 유료 리포트로 나갈 수 없어요");
    for (const v of guard.violations.filter((x) => x.code)) {
      console.log(`       [${v.code}] ${v.where} ${v.detail}`);
    }
  }
  const u = composed.usage;
  const cost = u
    ? (u.input - (u.cached ?? 0)) * 1.25e-6 + (u.cached ?? 0) * 0.125e-6 + u.output * 10e-6
    : null;
  const chars = report.sections.reduce(
    (sum, section) => sum + [section.summary, ...section.paragraphs].join("").length,
    0
  );

  console.log("");
  console.log(
    `글 완료 · ${(ms / 1000).toFixed(1)}초 · ${report.sections.length}/${scoped.outline.length}절 · 절당 ${Math.round(chars / report.sections.length)}자`
  );
  if (cost !== null) console.log(`실비 약 $${cost.toFixed(4)}`);
  console.log(
    `가드 위반 ${guard.violations.length}건${guard.violations.length ? ": " + guard.violations.map((v) => `${v.kind}/${v.where}`).join(", ") : ""}`
  );
}

// 결과 페이지가 읽는 보관함 항목 그대로. 해금된 상태(full 채움)로 만든다.
const entry = {
  readingId,
  blob: "",
  category: PRODUCT_ID,
  label: product.title,
  characterId: report.characterNote?.characterId ?? "",
  teaser,
  full,
  // 구조화 리포트도 함께 심는다. 이게 없으면 뷰어가 텍스트만 파싱해서
  // 절 아래 근거 칩(facts_used)이 통째로 사라진다 — 실제 화면과 달라진다.
  report,
  chart: { me: pillars(me), partner: pillars(partner) },
  price: 0,
  createdAt: Date.now(),
  previewSections: report.sections.slice(0, 2).map((s) => ({ title: s.title, excerpt: s.summary })),
  lockedSectionTitles: [],
  scoreLabel: null,
  score: null,
};

fs.writeFileSync(OUT, JSON.stringify({ entry, report, question: QUESTION }, null, 2), "utf8");

// ── 삽화 ── 장당 60초 · 약 $0.07. 실수로 나가지 않게 --images 를 붙일 때만.
if (has("images")) {
  const concept = conceptFor(PRODUCT_ID);
  const chapters = pickIllustrated(
    buildChapters(reportPieces(report), {
      toc: scoped.outline,
      chapterTitles: concept.chapters,
      epilogueTitle: concept.epilogue,
    }).map((chapter) => ({
      chapter: chapter.number,
      title: chapter.title,
      gist: chapter.sections[0]?.paragraphs[0] ?? chapter.title,
    }))
  );

  console.log("");
  console.log(`삽화 ${chapters.length}장… 장당 60초쯤, 약 $${(chapters.length * 0.07).toFixed(2)}`);

  // 서버의 runImageJob 을 그대로 쓰지 않는다 — 그쪽은 supabase-admin 을 거치고,
  // 그 파일은 "server-only" 라 Next 밖에서는 불러올 수 없다. 순서만 같게 직접 만든다.
  const t1 = Date.now();
  const prompts = await writeImagePrompts(chapters, { occupation: OCCUPATION, question: QUESTION });
  const state: { chapter: number; status: string; url?: string; alt?: string }[] = [];

  for (const chapter of chapters) {
    const found = prompts.find((p) => p.chapter === chapter.chapter);
    if (!found) {
      console.log(`  ${chapter.chapter}장 — 지시문이 안 나왔거나 선에 걸렸어요`);
      state.push({ chapter: chapter.chapter, status: "failed" });
      continue;
    }
    console.log(`  ${chapter.chapter}장 — ${found.prompt.slice(0, 56)}…`);
    const bytes = await renderImage(found.prompt);
    if (!bytes) {
      state.push({ chapter: chapter.chapter, status: "failed" });
      continue;
    }
    const dir = `public/generated/${readingId}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${chapter.chapter}.png`, bytes);
    state.push({
      chapter: chapter.chapter,
      status: "ready",
      url: `/generated/${readingId}/${chapter.chapter}.png`,
      alt: found.alt,
    });
  }

  // 부적 — 마지막 장에서 받아 가는 것. 장 그림과 다른 물건이라 따로 뽑는다.
  const chartLine = `${pillars(me)}`;
  const plan = planTalisman(chartLine, product.title);
  console.log(`  부적 — ${plan.element} 기운`);
  const talisman = await renderImage(plan.prompt, "talisman");
  if (talisman) {
    const dir = `public/generated/${readingId}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${TALISMAN_SLOT}.png`, talisman);
    state.push({
      chapter: TALISMAN_SLOT,
      status: "ready",
      url: `/generated/${readingId}/${TALISMAN_SLOT}.png`,
      alt: plan.alt,
    });
  } else {
    state.push({ chapter: TALISMAN_SLOT, status: "failed" });
  }

  fs.mkdirSync("data/reading-images", { recursive: true });
  fs.writeFileSync(`data/reading-images/${readingId}.json`, JSON.stringify(state), "utf8");
  const ok = state.filter((x) => x.status === "ready").length;
  console.log(`삽화 ${ok}/${chapters.length}장 · ${((Date.now() - t1) / 1000).toFixed(0)}초`);
}

console.log("");
console.log(`${OUT} 에 저장했어요. npm run dev 를 켜고 http://localhost:3000/dev/reading-preview 로 여세요.`);
