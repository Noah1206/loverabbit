// 출시 전 훑기 — 실제 유저가 넣을 값으로 계산층이 전부 서는지.
//
// 모델을 부르지 않는다. 부를 필요가 없어서다. 리포트에서 "지어내지 않았는가" 를
// 지탱하는 것은 문장이 아니라 그 앞의 계산이다. 명식이 서고, 규칙이 켜지고,
// 목차만큼 근거가 모이면 모델은 그 안에서만 쓴다. 그 앞이 비면 무슨 모델을
// 써도 빈자리를 지어서 채운다.
//
// 그래서 여기서 보는 것은 세 가지다.
//   1) 터지지 않는가        — 생년월일시 조합에서 예외가 나는가
//   2) 근거가 모이는가      — 절 수만큼 규칙이 켜지는가 (모자라면 절 하나가 남의 근거로 간다)
//   3) 목차가 남아 있는가   — scopeOutline 이 절을 얼마나 깎는가
//
//   npx tsx scripts/reading-sweep.mts
//   npx tsx scripts/reading-sweep.mts --full     (조합을 넓게)

import { buildSajuFacts } from "../src/lib/saju-facts";
import { forbiddenFromRules, matchRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { PRODUCTS } from "../src/lib/products";
import { previewSections } from "../src/lib/reading-compose";
import type { Gender } from "../src/lib/saju";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const FULL = process.argv.includes("--full");

// ── 유저가 실제로 넣는 값 ────────────────────────────────
//
// 광고로 들어오는 사람이 대부분 20~40대다. 그래도 양 끝을 같이 본다 —
// 절기 경계와 대운 계산이 나이에 따라 다른 길로 간다.
const YEARS = FULL
  ? Array.from({ length: 41 }, (_, i) => 1966 + i)
  : [1968, 1975, 1983, 1990, 1993, 1997, 2001, 2005];

// 절기 경계(4일·5일·6일 언저리)와 월 끝을 일부러 문다. 여기서 월주가 갈린다.
const DAYS = FULL ? [1, 3, 4, 5, 6, 7, 15, 20, 28, 29, 30, 31] : [1, 4, 5, 6, 15, 28, 31];
// 자시(23~01)는 날짜가 넘어가는 자리라 따로 문다. null 은 "태어난 시간 모름".
const HOURS: (number | null)[] = FULL
  ? [null, 0, 1, 5, 7, 11, 13, 17, 19, 21, 23]
  : [null, 0, 7, 13, 23];
const GENDERS: Gender[] = ["M", "F"];

/** 직업은 계산에 안 들어간다. 그래도 프롬프트 조립까지 서는지는 봐야 한다. */
const OCCUPATIONS = ["간호사", "고등학교 교사", "프리랜서 디자이너", "군인", ""];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

interface Fail {
  kind: "throw" | "rules" | "outline" | "facts";
  product: string;
  birth: string;
  detail: string;
}

const fails: Fail[] = [];
let cases = 0;
let ruleTotal = 0;
let ruleMin = Number.POSITIVE_INFINITY;
let outlineCut = 0;
const cutNotes = new Map<string, number>();
interface Stat {
  cases: number;
  ruleMin: number;
  cutCases: number;
  /** 절 수만큼 근거가 모이지 않은 건수 — 상대 유무로 갈라 센다 */
  short: { withPartner: number; withoutPartner: number };
  /** 모자란 절의 합. 나누면 "보통 몇 절이 비는가" 가 된다 */
  shortSum: number;
  partnerCases: number;
}
const perProduct = new Map<string, Stat>();

function label(y: number, m: number, d: number, h: number | null, g: Gender) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ${h === null ? "시각미상" : `${h}시`} ${g}`;
}

for (const product of PRODUCTS) {
  const stat: Stat = {
    cases: 0,
    ruleMin: Number.POSITIVE_INFINITY,
    cutCases: 0,
    short: { withPartner: 0, withoutPartner: 0 },
    shortSum: 0,
    partnerCases: 0,
  };
  perProduct.set(product.id, stat);

  // 상대 정보를 받는 상품인지. 궁합·재회처럼 둘을 보는 상품에서 상대가 없으면
  // 규칙 절반이 죽는다 — 그 상태로도 목차가 서는지 함께 본다.
  const needsPartner = product.needsPartner === true;

  let i = 0;
  for (const year of YEARS) {
    for (const month of [1, 2, 3, 5, 7, 9, 11, 12]) {
      for (const day of DAYS) {
        if (day > daysInMonth(year, month)) continue;
        const hour = HOURS[i % HOURS.length]!;
        const gender = GENDERS[i % GENDERS.length]!;
        const occupation = OCCUPATIONS[i % OCCUPATIONS.length]!;
        i += 1;

        const birth = label(year, month, day, hour, gender);
        try {
          const me = buildSajuFacts({ year, month, day, hour, gender }, NOW);
          if (!me.fourPillars.year || !me.fourPillars.day) {
            fails.push({ kind: "facts", product: product.id, birth, detail: "명식이 비었다" });
            continue;
          }

          /*
            상대를 넣었는가.

            두 사람을 보는 상품에서는 이제 안 넣고 넘어갈 수 없다 — 화면에서 감추고
            API 에서도 막는다. 그래서 여기서도 항상 넣는다. 예전에는 번갈아 봤는데,
            그러면 도달할 수 없는 조합의 실패가 표에 섞여 실제보다 나쁘게 나온다.

            혼자 보는 상품은 상대를 넣을지 고를 수 있으므로 둘 다 본다.
          */
          const withPartner = needsPartner || i % 5 === 0;
          const partner = withPartner
            ? buildSajuFacts(
                {
                  year: year - 2,
                  month: ((month + 4) % 12) + 1,
                  day: Math.min(day + 3, 28),
                  hour: hour === null ? 9 : (hour + 6) % 24,
                  gender: gender === "F" ? "M" : "F",
                },
                NOW
              )
            : null;

          const floor = Math.max(12, product.toc.length);
          const matched = matchRules(me, partner, product.id, floor);
          forbiddenFromRules(matched);
          // 고급 명리(격국·용신·조후)는 buildSajuFacts 안에서 이미 돈다. 여기서는
          // 그 결과가 붙어 있는지만 본다 — 없으면 ADVANCED 절이 빈 채로 나간다.
          if (!me.advanced) {
            fails.push({ kind: "facts", product: product.id, birth, detail: "advanced 없음" });
          }

          const scoped = scopeOutline({
            product: product.id,
            outline: product.toc,
            facts: me,
            matchedRules: matched,
          });

          cases += 1;
          stat.cases += 1;
          ruleTotal += matched.length;
          ruleMin = Math.min(ruleMin, matched.length);
          stat.ruleMin = Math.min(stat.ruleMin, matched.length);

          // 규칙이 절 수보다 적으면 어느 절 하나는 딛을 것이 없다.
          if (withPartner) stat.partnerCases += 1;
          if (matched.length < product.toc.length) {
            stat.shortSum += product.toc.length - matched.length;
            if (withPartner) stat.short.withPartner += 1;
            else stat.short.withoutPartner += 1;
            fails.push({
              kind: "rules",
              product: product.id,
              birth,
              detail: `규칙 ${matched.length}개 < 목차 ${product.toc.length}절${withPartner ? "" : " (상대 없음)"}`,
            });
          }

          if (scoped.outline.length < product.toc.length) {
            outlineCut += 1;
            stat.cutCases += 1;
            for (const note of scoped.notes) {
              cutNotes.set(note, (cutNotes.get(note) ?? 0) + 1);
            }
          }
          // 미리보기로 내보내는 절보다 목차가 짧으면 잠글 것이 없다 = 게이트가 빈다.
          if (scoped.outline.length <= previewSections()) {
            fails.push({
              kind: "outline",
              product: product.id,
              birth,
              detail: `목차가 ${scoped.outline.length}절로 깎여 미리보기(${previewSections()}절)와 겹친다`,
            });
          }
        } catch (error) {
          fails.push({
            kind: "throw",
            product: product.id,
            birth,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}

// ── 결과 ─────────────────────────────────────────────────
const byKind = new Map<Fail["kind"], Fail[]>();
for (const fail of fails) {
  const list = byKind.get(fail.kind) ?? [];
  list.push(fail);
  byKind.set(fail.kind, list);
}

console.log(`\n검사한 조합  ${cases.toLocaleString()}건  (상품 ${PRODUCTS.length}개)`);
console.log(`규칙 평균    ${(ruleTotal / Math.max(cases, 1)).toFixed(1)}개  최소 ${ruleMin}개`);
console.log(`목차 축소    ${outlineCut}건 (${((outlineCut / Math.max(cases, 1)) * 100).toFixed(1)}%)`);

const KIND_LABEL: Record<Fail["kind"], string> = {
  throw: "예외",
  facts: "명식 없음",
  rules: "근거 부족",
  outline: "목차 붕괴",
};

console.log("\n── 막는 것 ──");
let blocking = 0;
for (const kind of ["throw", "facts", "outline", "rules"] as const) {
  const list = byKind.get(kind) ?? [];
  if (kind !== "rules") blocking += list.length;
  console.log(`  ${KIND_LABEL[kind].padEnd(8)} ${String(list.length).padStart(5)}건`);
  // 같은 원인이 수천 건 찍히므로 원인별로 접어서 보여준다.
  const grouped = new Map<string, { count: number; sample: Fail }>();
  for (const fail of list) {
    const key = `${fail.product} · ${fail.detail.replace(/\d+/g, "N")}`;
    const hit = grouped.get(key);
    if (hit) hit.count += 1;
    else grouped.set(key, { count: 1, sample: fail });
  }
  for (const [key, { count, sample }] of [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)) {
    console.log(`      ${String(count).padStart(5)}회  ${key}`);
    console.log(`             예: ${sample.birth} — ${sample.detail}`);
  }
}

if (cutNotes.size > 0) {
  console.log("\n── 목차를 깎은 이유 ──");
  for (const [note, count] of [...cutNotes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${String(count).padStart(5)}회  ${note}`);
  }
}

console.log("\n── 상품별 ── (절 수만큼 근거가 모였는가)");
console.log("  상품             절수  규칙최소  근거부족  평균부족   상대있을때  상대없을때");
for (const product of PRODUCTS) {
  const stat = perProduct.get(product.id)!;
  const min = Number.isFinite(stat.ruleMin) ? stat.ruleMin : 0;
  const shortCases = stat.short.withPartner + stat.short.withoutPartner;
  const pct = (shortCases / Math.max(stat.cases, 1)) * 100;
  const avgShort = shortCases ? (stat.shortSum / shortCases).toFixed(1) : "0.0";
  const noPartner = stat.cases - stat.partnerCases;
  const withPct = stat.partnerCases
    ? `${((stat.short.withPartner / stat.partnerCases) * 100).toFixed(0)}%`
    : "-";
  const withoutPct = noPartner
    ? `${((stat.short.withoutPartner / noPartner) * 100).toFixed(0)}%`
    : "-";
  console.log(
    `  ${product.id.padEnd(14)} ${String(product.toc.length).padStart(4)}   ${String(min).padStart(5)}   ${(pct.toFixed(0) + "%").padStart(7)}  ${(avgShort + "절").padStart(7)}   ${withPct.padStart(9)}   ${withoutPct.padStart(9)}`
  );
}

// 광고로 파는 세 갈래만 따로. 여기가 실제로 돈이 들어오는 자리다.
console.log("\n── 광고로 파는 상품 ──");
for (const id of ["sokgunghap", "insun", "ibyeol"]) {
  const product = PRODUCTS.find((item) => item.id === id);
  const stat = perProduct.get(id);
  if (!product || !stat) continue;
  const shortCases = stat.short.withPartner + stat.short.withoutPartner;
  console.log(
    `  ${id.padEnd(12)} ${product.toc.length}절  근거 부족 ${shortCases}/${stat.cases}건 (${((shortCases / stat.cases) * 100).toFixed(0)}%)`
  );
}

console.log(
  blocking === 0
    ? "\n계산층은 전 조합에서 선다. 막는 것 없음.\n"
    : `\n막는 것 ${blocking}건. 위 목록을 먼저 해결해야 한다.\n`
);
process.exit(blocking === 0 ? 0 : 1);
