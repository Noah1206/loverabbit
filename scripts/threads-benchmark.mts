// 허가 코퍼스와 패턴 라이브러리를 검증하고, 무엇이 들어 있는지 요약한다.
//
//   npx tsx scripts/threads-benchmark.mts validate
//   npx tsx scripts/threads-benchmark.mts analyze
//
// validate 는 docs/content/sajushiba-corpus-validation.md 를 남긴다. 실패한 행을
// 건너뛰지 않고 전부 적는 것이 이 스크립트의 요점이다 — 조용히 통과한 오류는
// 초안 스무 개에 그대로 번진다.

import fs from "node:fs";
import path from "node:path";

import {
  CORPUS_PATH,
  LIBRARY_PATH,
  loadCorpus,
  loadLibrary,
  validateLibrary,
} from "../src/lib/threads-corpus.ts";
import { LANE_PATTERNS } from "../src/lib/threads-patterns.ts";
import { outlineOf } from "../src/lib/threads-patterns.ts";

const REPORT = "docs/content/sajushiba-corpus-validation.md";
const command = process.argv[2] ?? "validate";

const corpus = loadCorpus();
const library = loadLibrary();
const libIssues = validateLibrary(library, corpus.rows);
const all = [...corpus.issues, ...libIssues];
const blocking = all.filter((i) => i.blocking);

if (command === "validate") {
  const lines: string[] = [];
  lines.push("# 사주시바 코퍼스 검증");
  lines.push("");
  lines.push(`- 코퍼스: \`${CORPUS_PATH}\``);
  lines.push(`- 패턴 라이브러리: \`${LIBRARY_PATH}\``);
  lines.push(`- 파싱된 행: **${corpus.rows.length}개**`);
  lines.push(`- 패턴: **${library.patterns.length}개**`);
  lines.push(`- 판정: **${blocking.length === 0 ? "통과" : "실패"}** (blocking ${blocking.length}건, advisory ${all.length - blocking.length}건)`);
  lines.push("");

  lines.push("## 접근 범위");
  lines.push("");
  lines.push("| post_id | 상태 | source_method | permission_scope | 자수 |");
  lines.push("|---|---|---|---|---:|");
  for (const row of corpus.rows) {
    lines.push(
      `| ${row.post_id} | ${row.extraction_status} | ${row.source_method} | ${row.permission_scope} | ${[...row.body].length} |`
    );
  }
  lines.push("");

  lines.push("## 검증 결과");
  lines.push("");
  if (all.length === 0) {
    lines.push("지적 사항 없음.");
  } else {
    lines.push("| 등급 | 위치 | 내용 |");
    lines.push("|---|---|---|");
    for (const issue of all) {
      lines.push(`| ${issue.blocking ? "**blocking**" : "advisory"} | ${issue.where} | ${issue.detail} |`);
    }
  }
  lines.push("");

  lines.push("## 패턴 → 원문 참조");
  lines.push("");
  lines.push("| pattern | funnel | source_post_ids | 레인 |");
  lines.push("|---|---|---|---|");
  for (const pattern of library.patterns) {
    const lanes = Object.entries(LANE_PATTERNS)
      .filter(([, ids]) => ids.includes(pattern.id))
      .map(([lane]) => lane);
    lines.push(
      `| ${pattern.id} | ${pattern.funnel} | ${pattern.source_post_ids.join(", ")} | ${lanes.join(", ") || "(미배정)"} |`
    );
  }
  lines.push("");

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  console.log(lines.slice(0, 8).join("\n"));
  console.log(`\n-> ${REPORT}`);
  process.exit(blocking.length === 0 ? 0 : 1);
}

if (command === "analyze") {
  console.log(`행 ${corpus.rows.length}개 / 패턴 ${library.patterns.length}개`);
  console.log("");
  const chars = corpus.rows.map((r) => [...r.body].length);
  const lines = corpus.rows.map((r) => r.body.split(/\r?\n/).filter((l) => l.trim()).length);
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  console.log(`평균 ${avg(chars)}자 / 평균 ${avg(lines)}줄 / 최장 ${Math.max(...chars)}자`);
  console.log(`500자를 넘는 원문 ${chars.filter((c) => c > 500).length}개 — 그만큼은 체인으로 나눠야 한다`);
  console.log("");
  for (const row of corpus.rows) {
    console.log(`── ${row.post_id} (${row.content_funnel}, ${row.format})`);
    console.log(`   ${outlineOf(row.body).join(" / ")}`);
  }
  process.exit(0);
}

console.error(`모르는 명령 — ${command}. validate 또는 analyze.`);
process.exit(2);
