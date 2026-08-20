// 지지 음양 모드 병렬 감사 — 운영 기본값을 바꾸지 않은 채 두 모드를 비교한다.
//
//   npm run myeongri:audit:branch-yinyang
//   npm run myeongri:audit:branch-yinyang -- --input <fixture.json>
//   npm run myeongri:audit:branch-yinyang -- --out docs/audit/branch-yin-yang-comparison.md
//
// 입력을 주지 않으면 **결정론적 synthetic fixture**를 쓴다 (12지지 × 10일간 전수).
// 실제 사람의 명식은 절대 넣지 마라 — 이 스크립트의 출력은 문서로 커밋된다.
//
// 승인된 익명 코퍼스가 생기면 --input 으로 넣는다. 그 전까지 여기 숫자는
// synthetic 기준이므로, 다른 곳에서 인용된 실측치와 직접 비교하지 마라.

import fs from "node:fs";
import path from "node:path";
import { CHEONGAN, CHEONGAN_OHAENG, JIJI, JIJI_OHAENG, type Ohaeng } from "../src/lib/saju";
import { branchIsYang, CALCULATION_POLICY_VERSION, type BranchYinYangMode } from "../src/lib/myeongri/policy";
import { branchPolarityTable, HIDDEN_STEM_TABLE_VERSION } from "../src/lib/myeongri/hidden-stems";

const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

function tenGodOf(dayEl: Ohaeng, dayYang: boolean, targetEl: Ohaeng, targetYang: boolean): string {
  const same = dayYang === targetYang;
  if (targetEl === dayEl) return same ? "비견" : "겁재";
  if (GENERATES[dayEl] === targetEl) return same ? "식신" : "상관";
  if (CONTROLS[dayEl] === targetEl) return same ? "편재" : "정재";
  if (CONTROLS[targetEl] === dayEl) return same ? "편관" : "정관";
  if (GENERATES[targetEl] === dayEl) return same ? "편인" : "정인";
  throw new Error("오행 관계가 다섯 갈래 밖으로 나갔다");
}

interface Fixture {
  /** 사람을 식별할 수 없는 표식만 */
  id: string;
  dayStemIdx: number;
  branchIdxs: number[];
}

/** 12지지 × 10일간 전수 — 결정론적이고 사람과 무관하다 */
function syntheticCorpus(): Fixture[] {
  const out: Fixture[] = [];
  for (let d = 0; d < 10; d += 1) {
    for (let b = 0; b < 12; b += 1) {
      // 한 명식에 지지 넷을 넣되, 기준 지지를 축으로 결정론적으로 고른다
      out.push({
        id: `syn-${CHEONGAN[d]}-${JIJI[b]}`,
        dayStemIdx: d,
        branchIdxs: [b, (b + 3) % 12, (b + 6) % 12, (b + 9) % 12],
      });
    }
  }
  return out;
}

function loadCorpus(file: string | null): { fixtures: Fixture[]; source: string } {
  if (!file) return { fixtures: syntheticCorpus(), source: "synthetic (12지지 × 10일간 전수, 결정론적)" };
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(raw)) throw new Error("입력은 Fixture 배열이어야 합니다");
  return { fixtures: raw as Fixture[], source: path.basename(file) };
}

interface Row {
  id: string;
  branch: string;
  before: string;
  after: string;
}

function run(fixtures: Fixture[]) {
  let positions = 0;
  let changed = 0;
  const affected = new Set<string>();
  const transitions = new Map<string, number>();
  const perBranch = new Map<string, number>();
  const perBranchTotal = new Map<string, number>();
  const examples: Row[] = [];

  for (const fx of fixtures) {
    const dayEl = CHEONGAN_OHAENG[fx.dayStemIdx] as Ohaeng;
    const dayYang = fx.dayStemIdx % 2 === 0;
    for (const b of fx.branchIdxs) {
      positions += 1;
      const branch = JIJI[b];
      perBranchTotal.set(branch, (perBranchTotal.get(branch) ?? 0) + 1);
      const el = JIJI_OHAENG[b] as Ohaeng;
      const before = tenGodOf(dayEl, dayYang, el, branchIsYang(b, "body"));
      const after = tenGodOf(dayEl, dayYang, el, branchIsYang(b, "main_hidden_stem"));
      if (before === after) continue;
      changed += 1;
      affected.add(fx.id);
      const key = `${before} → ${after}`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
      perBranch.set(branch, (perBranch.get(branch) ?? 0) + 1);
      if (examples.length < 20) examples.push({ id: fx.id, branch, before, after });
    }
  }

  return { positions, changed, affected: affected.size, transitions, perBranch, perBranchTotal, examples };
}

// ── 진입점 ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const at = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
};
const input = at("--input");
const outPath = at("--out") ?? "docs/audit/branch-yin-yang-comparison.md";

const { fixtures, source } = loadCorpus(input);
const r = run(fixtures);
const pct = (n: number, d: number) => (d === 0 ? "0.0" : ((n / d) * 100).toFixed(1));

const lines: string[] = [];
const w = (t = "") => lines.push(t);

w("# 지지 음양 모드 비교 — body 대 main_hidden_stem");
w();
w("> 이 문서는 `npm run myeongri:audit:branch-yinyang` 이 생성합니다. 직접 고치지 마세요.");
w("> **운영 기본값은 바뀌지 않았습니다** — 여전히 `body` 입니다.");
w();
w(`- 코퍼스: ${source}`);
w(`- 명식 수: ${fixtures.length}`);
w(`- 계산 정책: \`${CALCULATION_POLICY_VERSION}\``);
w(`- 지장간 표: \`${HIDDEN_STEM_TABLE_VERSION}\``);
w();
w("## 요약");
w();
w("| 지표 | 값 |");
w("|---|---|");
w(`| 총 명식 수 | ${fixtures.length} |`);
w(`| 평가한 지지 자리 수 | ${r.positions} |`);
w(`| 십성이 달라진 자리 | ${r.changed} (${pct(r.changed, r.positions)}%) |`);
w(`| 영향을 받은 명식 | ${r.affected} (${pct(r.affected, fixtures.length)}%) |`);
w();
w("## 십성 전환 분포");
w();
w("| 전환 | 건수 |");
w("|---|---|");
for (const [k, v] of [...r.transitions.entries()].sort((a, b) => b[1] - a[1])) w(`| ${k} | ${v} |`);
w();
w("## 지지별 분포");
w();
w("| 지지 | 체 음양 | 본기 | 본기 음양 | 갈림 | 평가 자리 | 달라진 자리 |");
w("|---|---|---|---|---|---|---|");
for (const p of branchPolarityTable()) {
  const total = r.perBranchTotal.get(p.branch) ?? 0;
  const diff = r.perBranch.get(p.branch) ?? 0;
  w(
    `| ${p.branch} | ${p.bodyPolarity === "yang" ? "양" : "음"} | ${p.mainHiddenStem} | ` +
      `${p.mainHiddenStemPolarity === "yang" ? "양" : "음"} | ${p.differsFromBody ? "✔" : ""} | ${total} | ${diff} |`
  );
}
w();
w("## 영향 예시 (최대 20건)");
w();
w("| fixture | 지지 | body | main_hidden_stem |");
w("|---|---|---|---|");
for (const e of r.examples) w(`| \`${e.id}\` | ${e.branch} | ${e.before} | ${e.after} |`);
w();
w("---");
w();
w("사람을 식별할 수 있는 값은 담지 않습니다. `--input` 으로 코퍼스를 줄 때도");
w("`id` 는 익명 표식이어야 합니다.");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

console.log(`코퍼스: ${source} · 명식 ${fixtures.length}개`);
console.log(`지지 자리 ${r.positions}곳 중 ${r.changed}곳(${pct(r.changed, r.positions)}%) 에서 십성이 달라짐`);
console.log(`영향받은 명식 ${r.affected}개 (${pct(r.affected, fixtures.length)}%)`);
console.log(`보고서: ${outPath}`);
