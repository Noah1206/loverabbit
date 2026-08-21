// 초안 생성 · 검수 큐 · 미리보기 · 허가 상태.
//
//   npx tsx --env-file=.env scripts/threads-drafts.mts generate --count 20 --mode draft_only
//   npx tsx --env-file=.env scripts/threads-drafts.mts generate --batch reuse --count 10
//   npx tsx scripts/threads-drafts.mts review --status needs_review
//   npx tsx scripts/threads-drafts.mts preview --id draft-inner-정관
//   npx tsx scripts/threads-drafts.mts permission
//
// generate 는 모델을 부르므로 실비가 든다. 이미 만들어 둔 초안은 다시 만들지 않는다
// (--force 로 덮어쓴다) — reading-preview.mts 가 같은 이유로 같은 규칙을 쓴다.

import fs from "node:fs";
import path from "node:path";

import { loadCorpus, loadLibrary } from "../src/lib/threads-corpus.ts";
import { buildPlan, DEFAULT_START } from "../src/lib/threads-plan.ts";
import { buildReusePlan, REUSE_START, type ReuseSlot } from "../src/lib/threads-reuse-plan.ts";
import { generateDraft } from "../src/lib/threads-draft.ts";
import { allowDirectCopy, publishMode } from "../src/lib/threads-content.ts";
import type {
  AuthorizedReuseMode,
  GeneratedThreadDraft,
  ThreadDraftStatus,
} from "../src/lib/threads-content.ts";
import { registryReport } from "../src/content/reference/sajushiba/permission-registry.ts";
import { loadQueue, previewOf, saveQueue, upsert } from "../src/lib/threads-queue.ts";

const REUSE_JSON = "data/generated/love-rabbit-authorized-reuse-drafts-v1.json";
const REUSE_DOC = "docs/content/love-rabbit-authorized-reuse-drafts-v1.md";

const args = process.argv.slice(2);
const command = args[0] ?? "generate";
const argOf = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

// --mode 는 확인용이다. 이 스크립트는 어떤 값이 와도 게시하지 않는다.
const requestedMode = argOf("mode");
if (requestedMode && requestedMode !== "draft_only") {
  console.error(`이 스크립트는 초안까지만 만든다. --mode ${requestedMode} 는 받지 않는다.`);
  process.exit(2);
}

const STATUS_MARK: Record<ThreadDraftStatus, string> = {
  blocked_by_missing_facts: "사실없음",
  needs_permission_metadata: "허가대기",
  guard_failed: "가드실패",
  needs_review: "검토대기",
  draft: "초안",
  approved: "승인됨",
  scheduled: "예약됨",
  published: "게시됨",
};

if (command === "permission") {
  const report = registryReport();
  console.log(`레지스트리 ${report.total}개 / 증빙 채워짐 ${report.withEvidence}개`);
  console.log(`원문 재사용 후보: ${report.verbatimCandidates.join(", ")}`);
  if (!report.evidenceReady) {
    console.log("");
    console.log("verbatim_* 모드가 잠겨 있다. 여는 방법:");
    console.log("  1. src/content/reference/sajushiba/PERMISSION.md 의 굵은 세 항목을 채운다");
    console.log("  2. permission-registry.ts 의 PERMISSION_EVIDENCE 에 같은 값을 넣는다");
    console.log("  3. THREADS_ALLOW_DIRECT_COPY=1 로 스위치를 켠다");
  }
  process.exit(0);
}

if (command === "generate") {
  const count = Number(argOf("count") ?? 20);
  const force = has("force");
  const reuse = argOf("batch") === "reuse";
  const start = argOf("start") ?? (reuse ? REUSE_START : DEFAULT_START);

  const corpus = loadCorpus();
  if (!corpus.ok) {
    console.error("코퍼스 검증 실패 — threads-benchmark.mts validate 먼저 돌려라.");
    process.exit(1);
  }
  const library = loadLibrary();

  type Slot = { input: ReuseSlot["input"]; note: string; reuseMode?: AuthorizedReuseMode; sourcePostIds?: string[] };
  const plan: Slot[] = reuse
    ? buildReusePlan(start).slice(0, count)
    : buildPlan(start).slice(0, count);

  const report = registryReport();
  console.log(`모드 ${publishMode()} / 원문 재사용 스위치 ${allowDirectCopy() ? "켜짐" : "꺼짐"}`);
  console.log(
    `허가 증빙 ${report.withEvidence}/${report.total} — ${report.evidenceReady ? "verbatim 열림" : "verbatim 잠김"}`
  );
  console.log(`편성 ${plan.length}칸 (${reuse ? "원문 재사용 배치" : "기본 배치"}), 기준일 ${start}\n`);

  let queue = loadQueue();
  const bodies: string[] = queue.flatMap((d) => d.posts.map((p) => p.body));

  for (const slot of plan) {
    const id = `draft-${slot.input.id}`;
    const existing = queue.find((d) => d.id === id);
    if (existing && !force) {
      console.log(`· ${slot.note} — 이미 있음 (${existing.status})`);
      continue;
    }

    const result = await generateDraft({
      input: slot.input,
      library,
      corpus: corpus.rows,
      previousBodies: bodies,
      reuseMode: slot.reuseMode,
    });

    if (result.unavailable) {
      console.error(`! ${slot.note} — ${result.unavailable}`);
      break;
    }

    queue = upsert(queue, result.draft);
    bodies.push(...result.draft.posts.map((p) => p.body));
    saveQueue(queue);

    const chars = result.draft.posts.map((p) => p.charCount).join("+");
    const spans = result.draft.directCopySpans.length;
    console.log(
      `· ${slot.note} — ${STATUS_MARK[result.draft.status]}` +
        (chars ? ` (${chars}자, ${result.attempts}회${spans ? `, 재사용 ${spans}구간` : ""})` : "")
    );
  }

  const tally = new Map<ThreadDraftStatus, number>();
  for (const draft of queue) tally.set(draft.status, (tally.get(draft.status) ?? 0) + 1);
  console.log("\n큐 전체");
  for (const [status, n] of tally) console.log(`  ${status}: ${n}`);

  if (reuse) {
    // 재사용 배치는 따로 떨어뜨려 둔다. 승인 화면은 큐 하나를 보지만,
    // "원문을 어디까지 썼는가"를 되짚을 때는 이 배치만 따로 보게 된다.
    const ids = new Set(plan.map((slot) => `draft-${slot.input.id}`));
    const batch = queue.filter((d) => ids.has(d.id));
    fs.mkdirSync(path.dirname(REUSE_JSON), { recursive: true });
    fs.writeFileSync(
      REUSE_JSON,
      JSON.stringify({ version: 1, batch: "authorized-reuse-v1", drafts: batch }, null, 2),
      "utf8"
    );
    fs.mkdirSync(path.dirname(REUSE_DOC), { recursive: true });
    fs.writeFileSync(REUSE_DOC, reuseDoc(batch, plan), "utf8");
    console.log(`\n-> ${REUSE_JSON}`);
    console.log(`-> ${REUSE_DOC}`);
  }
  process.exit(0);
}

if (command === "review") {
  const wanted = argOf("status");
  const queue = loadQueue();
  const shown = wanted ? queue.filter((d) => d.status === wanted) : queue;
  if (shown.length === 0) {
    console.log(wanted ? `${wanted} 상태의 초안이 없다.` : "초안이 없다.");
    process.exit(0);
  }
  for (const draft of shown) {
    console.log(`── ${draft.id} [${draft.status}] ${draft.patternId} · ${draft.reuseMode}`);
    const guard = draft.guardResult as {
      violations?: Array<{ blocking: boolean; where: string; detail: string }>;
    } | null;
    for (const v of guard?.violations ?? []) {
      console.log(`   ${v.blocking ? "[blocking]" : "[advisory]"} ${v.where}: ${v.detail}`);
    }
    for (const reason of draft.missingFacts ?? []) console.log(`   [막힘] ${reason}`);
    console.log("");
  }
  process.exit(0);
}

if (command === "preview") {
  const id = argOf("id");
  const queue = loadQueue();
  const found: GeneratedThreadDraft[] = id ? queue.filter((d) => d.id === id) : queue;
  if (found.length === 0) {
    console.error(`초안을 찾을 수 없다 — ${id}`);
    process.exit(1);
  }
  for (const draft of found) {
    console.log(previewOf(draft));
    console.log("═".repeat(52));
  }
  process.exit(0);
}

console.error(`모르는 명령 — ${command}. generate / review / preview / permission.`);
process.exit(2);

/** 사람이 읽는 배치 기록 — 어느 원문을 어떤 모드로 썼는지가 한눈에 남아야 한다 */
function reuseDoc(
  drafts: GeneratedThreadDraft[],
  plan: Array<{ input: { id: string }; note: string; sourcePostIds?: string[] }>
): string {
  const report = registryReport();
  const lines: string[] = ["# 러브레빗 · 허가 원문 재사용 초안 v1", ""];
  lines.push(
    `- 허가 증빙: ${report.withEvidence}/${report.total} — ${report.evidenceReady ? "verbatim 열림" : "**verbatim 잠김**"}`
  );
  lines.push(`- 초안 ${drafts.length}개`);
  lines.push("");
  lines.push("| id | 모드 | 원문 | 상태 | 자수 | 재사용 구간 |");
  lines.push("|---|---|---|---|---:|---:|");
  for (const slot of plan) {
    const draft = drafts.find((d) => d.id === `draft-${slot.input.id}`);
    if (!draft) continue;
    lines.push(
      `| ${draft.id} | ${draft.reuseMode} | ${(slot.sourcePostIds ?? []).join(", ")} | ` +
        `${draft.status} | ${draft.posts.map((p) => p.charCount).join("+") || "-"} | ${draft.directCopySpans.length} |`
    );
  }
  lines.push("");
  for (const draft of drafts) {
    lines.push(`## ${draft.id}`);
    lines.push("");
    lines.push(`- 모드: \`${draft.reuseMode}\``);
    lines.push(`- 참조 원문: ${draft.benchmarkSourcePostIds.join(", ") || "(없음)"}`);
    lines.push(`- 직접 재사용: ${draft.directCopySourcePostIds.join(", ") || "(없음)"}`);
    lines.push(`- 규칙: ${draft.ruleIdsUsed.join(", ") || "(없음)"}`);
    lines.push(`- 상태: **${draft.status}**`);
    for (const reason of draft.missingFacts ?? []) lines.push(`  - ${reason}`);
    for (const span of draft.directCopySpans) {
      lines.push(`- 원문 구간 (${span.sourcePostId}): "${span.text}"`);
    }
    for (const log of draft.sourceTransformLog) {
      lines.push(`- 변형 [${log.reason}] "${log.originalText}" → "${log.transformedText}"`);
    }
    lines.push("");
    for (const post of draft.posts) {
      lines.push("```");
      lines.push(post.body);
      lines.push("```");
      lines.push(`> ${post.charCount}자`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
