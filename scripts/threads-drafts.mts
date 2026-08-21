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
import { buildDailyPlan } from "../src/lib/threads-daily-plan.ts";
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
import {
  clearRewrite,
  loadBrief,
  loadRewrites,
  operatorBlock,
} from "../src/lib/threads-brief.ts";

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
  const daily = has("daily");
  // 기본 편성 수는 배치마다 다르다. --daily 는 "그날의 두 자리"라서 2 다.
  // 여기서 20 을 그대로 넘기면 buildDailyPlan 이 min(20, 쓸 수 있는 칸) 을 잡아
  // 그날 쓸 수 있는 칸을 통째로 뱉는다. 매일 열세 건이 나오고, 회전도 무의미해진다.
  const count = Number(argOf("count") ?? (daily ? 2 : 20));
  const force = has("force");
  const reuse = argOf("batch") === "reuse";
  // --daily 는 기준일이 곧 "오늘"이다. 배치가 날짜를 계산해 넘기게 하면 배치마다
  // 그 계산이 하나씩 생기고, 그중 하나는 시간대를 틀린다. 여기서 한 번만 구한다.
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const start =
    argOf("start") ?? (has("daily") ? todayKst : reuse ? REUSE_START : DEFAULT_START);

  const corpus = loadCorpus();
  if (!corpus.ok) {
    console.error("코퍼스 검증 실패 — threads-benchmark.mts validate 먼저 돌려라.");
    process.exit(1);
  }
  const library = loadLibrary();

  type Slot = { input: ReuseSlot["input"]; note: string; reuseMode?: AuthorizedReuseMode; sourcePostIds?: string[] };
  // --daily 는 그날 쓸 칸만 골라 온다. ID 에 날짜가 붙어 매일 새 초안이 된다.
  // 이게 없으면 스무 칸이 다 찬 다음 날부터 생성기가 전부 "이미 있음"으로 넘긴다.
  let plan: Slot[] = daily
    ? buildDailyPlan({ date: start, count })
    : reuse
      ? buildReusePlan(start)
      : buildPlan(start);

  // --daily 초안의 ID 는 앞에 날짜가 붙는다 (2026-08-22-inner-정관).
  // 사람이 부르는 이름은 날짜 없는 쪽이고, CLAUDE.md 도 그렇게 안내한다.
  // 그래서 --only 와 재작성 요청 키를 맞출 때는 날짜를 떼고 본다.
  const bareId = (id: string) => id.replace(/^d{4}-d{2}-d{2}-/, "");

  // --only 는 재작성용이다. 계획 전체를 돌리지 않고 지목한 초안만 다시 쓴다.
  const only = argOf("only");
  if (only) {
    const wanted = only.split(",").map((s) => s.trim().replace(/^draft-/, ""));
    plan = plan.filter((slot) => wanted.includes(slot.input.id) || wanted.includes(bareId(slot.input.id)));
    if (plan.length === 0) {
      console.error(`--only ${only} 에 맞는 칸이 계획에 없다.`);
      process.exit(2);
    }
  } else if (!daily) {
    plan = plan.slice(0, count);
  }

  const report = registryReport();
  console.log(`모드 ${publishMode()} / 원문 재사용 스위치 ${allowDirectCopy() ? "켜짐" : "꺼짐"}`);
  console.log(
    `허가 증빙 ${report.withEvidence}/${report.total} — ${report.evidenceReady ? "verbatim 열림" : "verbatim 잠김"}`
  );
  console.log(`편성 ${plan.length}칸 (${reuse ? "원문 재사용 배치" : "기본 배치"}), 기준일 ${start}\n`);

  const brief = loadBrief();
  const rewrites = loadRewrites();
  if (brief) console.log("운영자 브리프 있음 — 표현·구성에만 적용된다");
  const pending = Object.keys(rewrites).length;
  if (pending > 0) console.log(`재작성 요청 ${pending}건`);
  console.log("");

  let queue = loadQueue();
  const bodies: string[] = queue.flatMap((d) => d.posts.map((p) => p.body));

  for (const slot of plan) {
    const id = `draft-${slot.input.id}`;
    const existing = queue.find((d) => d.id === id);
    // 어느 키로 걸렸는지 기억한다. 읽기만 느슨하게 하고 지울 때 원래 키를 쓰면,
    // 요청이 영영 안 지워져 같은 지적이 매번 다시 걸린다.
    const rewriteKey =
      [slot.input.id, id, bareId(slot.input.id)].find((key) => key in rewrites) ?? null;
    const rewrite = rewriteKey ? rewrites[rewriteKey] : null;
    // 재작성 요청이 있으면 --force 없이도 다시 쓴다. 그 요청 자체가 덮으라는 뜻이다.
    if (existing && !force && !rewrite && !only) {
      console.log(`· ${slot.note} — 이미 있음 (${existing.status})`);
      continue;
    }

    const result = await generateDraft({
      input: slot.input,
      library,
      corpus: corpus.rows,
      previousBodies: bodies,
      reuseMode: slot.reuseMode,
      operator: operatorBlock(brief, rewrite),
    });

    if (result.unavailable) {
      console.error(`! ${slot.note} — ${result.unavailable}`);
      break;
    }

    queue = upsert(queue, result.draft);
    bodies.push(...result.draft.posts.map((p) => p.body));
    saveQueue(queue);

    // 반영했으면 요청을 지운다. 안 지우면 다음 실행에서 같은 지적이 또 걸리고,
    // 이미 반영된 것을 또 반영하려다 문장이 한쪽으로 계속 밀린다.
    if (rewriteKey) clearRewrite(rewriteKey);

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
