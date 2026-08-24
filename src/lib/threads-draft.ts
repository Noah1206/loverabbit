// 초안 한 건을 만든다 — 입력 → 패턴 → 모델 → 가드 → 상태.
//
// reading-compose.ts 와 같은 자리다. 다른 점은 재시도 조건이다. 리딩은 8000 토큰짜리
// 생성이라 blocking 이 아니면 다시 돌리지 않았다. Threads 초안은 짧아서 한 번 더
// 돌리는 값이 싸다 — 그래서 blocking 이 있으면 한 번은 지적해서 다시 시킨다.

import { chatComplete, type ChatMsg } from "@/lib/ai";
import type { CorpusRow, PatternLibrary } from "@/lib/threads-corpus";
import { modeBlockers, patternById, referenceSourcesFor } from "@/lib/threads-patterns";
import type {
  AuthorizedReuseMode,
  GeneratedThreadDraft,
  LoveRabbitContentInput,
} from "@/lib/threads-content";
import { allowDirectCopy, countChars } from "@/lib/threads-content";
import { isVerbatim } from "@/content/reference/sajushiba/permission-registry";
import {
  buildThreadsInput,
  parseThreadDraft,
  threadsRetryPrompt,
  threadsSystemPrompt,
  type ThreadDraftOut,
} from "@/lib/threads-prompt";
import { checkThreadDraft, duplicateOfPrevious, type ThreadGuardResult } from "@/lib/threads-guard";

export interface GenerateOptions {
  input: LoveRabbitContentInput;
  library: PatternLibrary;
  corpus: CorpusRow[];
  /** 중복 검사용 — 이미 만들어 둔 초안들의 본문 */
  previousBodies?: string[];
  /** 테스트에서 모델을 갈아끼운다 */
  complete?: typeof chatComplete;
  now?: string;
  maxAttempts?: number;
  /** 이 초안이 원문을 어디까지 쓸 것인가. 없으면 pattern_only */
  reuseMode?: AuthorizedReuseMode;
  /** 운영자 지시 블록. 비어 있으면 예전과 같다. */
  operator?: string;
}

export interface GenerateResult {
  draft: GeneratedThreadDraft;
  guard: ThreadGuardResult | null;
  attempts: number;
  /** 모델을 못 불렀을 때 (키 없음 등) */
  unavailable?: string;
}

function emptyDraft(
  input: LoveRabbitContentInput,
  now: string,
  reuseMode: AuthorizedReuseMode
): GeneratedThreadDraft {
  return {
    id: `draft-${input.id}`,
    status: "draft",
    inputId: input.id,
    patternId: input.selectedPatternId,
    benchmarkSourcePostIds: [],
    directCopySourcePostIds: [],
    directCopyExcerpts: [],
    reuseMode,
    directCopySpans: [],
    sourceTransformLog: [],
    posts: [],
    ruleIdsUsed: [],
    claimIdsUsed: [],
    cta: { type: input.variables.cta.type, text: input.variables.cta.text },
    guardResult: null,
    llmReviewResult: null,
    createdAt: now,
  };
}

function toPosts(out: ThreadDraftOut) {
  return out.posts.map((p) => ({
    sequence: p.sequence,
    body: p.body,
    charCount: countChars(p.body),
  }));
}

/**
 * 입력이 막혀 있으면 모델을 부르지 않는다.
 *
 * 지시 문서 G — 빈 입력으로 생성에 넘기지 말고 blocked_by_missing_facts 로 저장하라.
 * 모델은 빈 자리를 아주 잘 채운다. 그게 문제다.
 */
export async function generateDraft(options: GenerateOptions): Promise<GenerateResult> {
  const now = options.now ?? new Date().toISOString();
  const { input, library, corpus } = options;
  const mode: AuthorizedReuseMode = options.reuseMode ?? "pattern_only";
  const draft = emptyDraft(input, now, mode);

  if (input.missingFacts?.length) {
    return {
      draft: { ...draft, status: "blocked_by_missing_facts", missingFacts: input.missingFacts },
      guard: null,
      attempts: 0,
    };
  }

  const pattern = patternById(library, input.selectedPatternId);
  const sources = referenceSourcesFor(pattern, corpus);
  const direct = allowDirectCopy();

  // 원문을 여는 모드인데 레지스트리가 하나도 안 열어 주면 모델을 부르지 않는다.
  // 뼈대만 보고 쓴 글에 verbatim 딱지를 붙이는 것이 가장 나쁜 결과다 —
  // 나중에 그 딱지가 "허가 범위 안에서 썼다"의 근거로 읽힌다.
  const blockers = modeBlockers(pattern, corpus, mode);
  if (blockers.length > 0) {
    return {
      draft: { ...draft, status: "needs_permission_metadata", missingFacts: blockers },
      guard: null,
      attempts: 0,
    };
  }
  // 환경변수는 마지막 잠금이다. 레지스트리가 열어 줘도 스위치가 꺼져 있으면 안 연다.
  if (isVerbatim(mode) && !direct) {
    return {
      draft: {
        ...draft,
        status: "needs_permission_metadata",
        missingFacts: [`THREADS_ALLOW_DIRECT_COPY 가 꺼져 있어 ${mode} 를 열지 않았다`],
      },
      guard: null,
      attempts: 0,
    };
  }

  const complete = options.complete ?? chatComplete;
  const system = threadsSystemPrompt(mode);
  const maxAttempts = options.maxAttempts ?? 2;

  let messages: ChatMsg[] = [
    { role: "user", content: buildThreadsInput(input, pattern, corpus, mode, options.operator ?? "") },
  ];
  let guard: ThreadGuardResult | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    const result = await complete(system, messages, 2000, { json: true, thinking: false });
    if (!result) {
      return { draft, guard: null, attempts, unavailable: "AI 키가 없어 모델을 부르지 못했다" };
    }
    const out = parseThreadDraft(result.text);
    if (!out) {
      messages = [
        ...messages,
        { role: "assistant", content: result.text },
        { role: "user", content: threadsRetryPrompt(["JSON 파싱 실패 — 객체 하나만 출력해"]) },
      ];
      continue;
    }

    const posts = toPosts(out);
    guard = checkThreadDraft(out, posts, {
      input,
      corpus,
      allowDirectCopy: direct,
      reuseMode: mode,
      pattern,
    });

    const dup = duplicateOfPrevious(posts, options.previousBodies ?? []);
    if (dup) {
      guard = {
        ...guard,
        mustRetry: true,
        ok: false,
        violations: [...guard.violations, { kind: "중복", where: "posts", detail: dup, blocking: true }],
      };
    }

    const filled: GeneratedThreadDraft = {
      ...draft,
      patternId: out.patternId || pattern.id,
      // 모델이 뭘 적어 냈든 참조 목록은 패턴이 실제로 근거로 삼은 것으로 덮는다.
      // 모델이 지어낸 ID가 메타데이터에 남으면 추적이 거짓말이 된다.
      benchmarkSourcePostIds: sources.map((s) => s.postId),
      directCopySourcePostIds: isVerbatim(mode) ? out.directCopySourcePostIds : [],
      directCopyExcerpts: isVerbatim(mode) ? out.directCopyExcerpts : [],
      directCopySpans: isVerbatim(mode) ? out.directCopySpans : [],
      sourceTransformLog: out.sourceTransformLog,
      fullReuse: mode === "verbatim_full_post" ? out.fullReuse === true : undefined,
      posts,
      ruleIdsUsed: out.ruleIdsUsed,
      claimIdsUsed: out.claimIdsUsed,
      cta: out.cta.type ? out.cta : draft.cta,
      guardResult: guard,
      status: guard.mustRetry ? "guard_failed" : guard.needsReview ? "needs_review" : "draft",
    };

    if (!guard.mustRetry) return { draft: filled, guard, attempts };
    if (attempts >= maxAttempts) return { draft: filled, guard, attempts };

    messages = [
      ...messages,
      { role: "assistant", content: result.text },
      {
        role: "user",
        content: threadsRetryPrompt(
          guard.violations.filter((v) => v.blocking).map((v) => `${v.where}: ${v.detail}`)
        ),
      },
    ];
  }

  return { draft: { ...draft, status: "guard_failed", guardResult: guard }, guard, attempts };
}
