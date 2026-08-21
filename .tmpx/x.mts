import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync(".reading-preview.sokgunghap.json","utf-8")).report;

// 표지(page 0)가 실제로 그리는 것 — reading/[id]/page.tsx 순서대로
console.log("① 헤드라인");
console.log(`   ${r.meta.headline}  (${r.meta.headline.length}자)\n`);

console.log("② 한눈에 보기 — 요약 카드 3장");
let cards = 0;
for (const c of r.summaryCards) {
  const n = c.value.length + (c.detail?.length ?? 0);
  cards += n;
  console.log(`   [${c.label}] ${c.value}`);
  console.log(`      ${(c.detail ?? "").slice(0, 70)}…  (${n}자)`);
}
console.log(`   소계 ${cards}자\n`);

console.log(`③ 목차 — 제목만 ${r.sections.length}줄`);
r.sections.slice(0,3).forEach((s:any,i:number)=>console.log(`   ${i+1}. ${s.title}`));
console.log(`   … 나머지 ${r.sections.length-3}줄\n`);

// 맛보기 = previewSections[0].excerpt 의 앞 2문장
const first = r.sections[0];
const body = [first.summary, ...first.paragraphs].join(" ").replace(/\s+/g," ").trim();
const excerpt = (body.match(/[^.!?。]+[.!?。]?/g) ?? [body]).slice(0,2).join(" ").trim().slice(0,360);
const taste = (excerpt.match(/[^.!?]+[.!?]/g) ?? [excerpt]).slice(0,2).join(" ").trim();
console.log("④ 맛보기 — 1장 앞 2문장");
console.log(`   ${taste}`);
console.log(`   (${taste.length}자)\n`);

console.log(`합계 ${r.meta.headline.length + cards + taste.length}자 + 목차 ${r.sections.length}줄`);
console.log(`\n결제 후 이어지는 것: ${r.sections.length - 2}절 (미리보기 2절은 이미 만들어 둠)`);
