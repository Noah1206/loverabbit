// 사주시바 허가 코퍼스와 패턴 라이브러리를 읽고 검증한다.
//
// 이 파일이 하는 일은 "믿을 수 있는 원본이 맞는지" 한 번 훑는 것이다.
// 코퍼스가 초안 생성의 스타일 기준이 되므로, 여기서 조용히 통과시킨 오류는
// 20개 초안 전부에 번진다. 그래서 실패한 행을 건너뛰지 않고 전부 모아 돌려준다.
//
// 런타임(앱 라우트)에서는 쓰지 않는다. 스크립트와 테스트에서만 부른다 —
// 파일시스템을 읽기 때문이다.

import fs from "node:fs";
import path from "node:path";

/** 코퍼스 행 하나에 반드시 있어야 하는 필드. 지시 문서 A-2가 정한 목록이다. */
export const REQUIRED_FIELDS = [
  "post_id",
  "body",
  "permission_scope",
  "source_method",
  "extraction_status",
] as const;

export type ExtractionStatus = "complete" | "partial_parent_unavailable";

export interface CorpusRow {
  post_id: string;
  url: string;
  author: string;
  published_at: string;
  body: string;
  format: "text" | "thread_chain";
  content_funnel: string;
  topic_tags: string[];
  permission_scope: string;
  source_method: string;
  extraction_status: ExtractionStatus;
}

export interface SajushibaPattern {
  id: string;
  name: string;
  source_post_ids: string[];
  funnel: string;
  best_for: string[];
  hook_formula: string;
  body_formula: string[];
  rhythm: string;
  style_markers: string[];
  conversion_bridge: string;
  source_evidence?: string[];
  love_rabbit_policy: string;
}

export interface PatternLibrary {
  metadata: {
    corpus_file: string;
    corpus_post_count: number;
    permission_scope: string;
    purpose: string;
    notes: string;
  };
  corpus_observations: Record<string, unknown>;
  patterns: SajushibaPattern[];
}

/** 어디서 무엇이 틀렸는지. 행 번호를 남겨야 원본을 고칠 수 있다. */
export interface CorpusIssue {
  where: string;
  detail: string;
  blocking: boolean;
}

export interface CorpusValidation {
  rows: CorpusRow[];
  issues: CorpusIssue[];
  ok: boolean;
}

export const CORPUS_PATH = "src/content/reference/sajushiba/corpus.v1.jsonl";
export const LIBRARY_PATH = "src/content/reference/sajushiba/pattern-library.v1.json";

/**
 * 코퍼스의 출처와 허가 근거.
 *
 * 11개 행 전부가 같은 값을 갖고 있어 상수로 뽑았다. 다른 값이 섞여 들어오면
 * 그건 v1이 아닌 다른 경로로 들어온 원문이라는 뜻이라 검증에서 잡는다.
 */
export const EXPECTED_SOURCE_METHOD = "public_threads_extraction";
export const EXPECTED_PERMISSION_SCOPE = "user_asserted_style_and_copy_reuse";

function repoPath(rel: string): string {
  return path.resolve(process.cwd(), rel);
}

export function readCorpusText(rel = CORPUS_PATH): string {
  return fs.readFileSync(repoPath(rel), "utf8");
}

export function readLibraryText(rel = LIBRARY_PATH): string {
  return fs.readFileSync(repoPath(rel), "utf8");
}

/**
 * JSONL을 행 단위로 파싱한다.
 *
 * 한 행이 깨져도 나머지를 계속 읽는다. 첫 오류에서 멈추면 "고치고 다시 돌리기"를
 * 열한 번 해야 하는데, 그럴 이유가 없다.
 */
export function parseCorpus(text: string): CorpusValidation {
  const rows: CorpusRow[] = [];
  const issues: CorpusIssue[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    if (!line.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      issues.push({
        where: `line ${lineNo}`,
        detail: `JSON 파싱 실패 — ${(error as Error).message}`,
        blocking: true,
      });
      return;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      issues.push({ where: `line ${lineNo}`, detail: "객체가 아니다", blocking: true });
      return;
    }
    const row = parsed as Record<string, unknown>;

    const missing = REQUIRED_FIELDS.filter((f) => {
      const v = row[f];
      return typeof v !== "string" || v.trim() === "";
    });
    if (missing.length > 0) {
      issues.push({
        where: `line ${lineNo}`,
        detail: `필수 필드 누락 — ${missing.join(", ")}`,
        blocking: true,
      });
      return;
    }

    const postId = row.post_id as string;
    if (seen.has(postId)) {
      issues.push({ where: `line ${lineNo}`, detail: `post_id 중복 — ${postId}`, blocking: true });
      return;
    }
    seen.add(postId);

    // 출처와 허가 근거가 v1의 값과 다르면, 다른 경로로 들어온 원문이다.
    // 막지는 않고 기록만 남긴다 — 사주시바가 직접 내보낸 파일을 합칠 때
    // source_method가 달라지는 것은 정상이기 때문이다.
    if (row.source_method !== EXPECTED_SOURCE_METHOD) {
      issues.push({
        where: `line ${lineNo}`,
        detail: `source_method가 "${String(row.source_method)}" — v1 기준값은 "${EXPECTED_SOURCE_METHOD}"`,
        blocking: false,
      });
    }
    if (row.permission_scope !== EXPECTED_PERMISSION_SCOPE) {
      issues.push({
        where: `line ${lineNo}`,
        detail: `permission_scope가 "${String(row.permission_scope)}" — v1 기준값은 "${EXPECTED_PERMISSION_SCOPE}"`,
        blocking: false,
      });
    }

    const status = row.extraction_status as string;
    if (status !== "complete" && status !== "partial_parent_unavailable") {
      issues.push({
        where: `line ${lineNo}`,
        detail: `extraction_status가 "${status}" — complete / partial_parent_unavailable 중 하나여야 한다`,
        blocking: true,
      });
      return;
    }
    // 부모 글을 못 가져온 행은 문맥이 잘려 있다. 스타일 참조로는 쓸 수 있어도
    // 문장을 그대로 옮기면 앞뒤가 없는 말이 된다.
    if (status === "partial_parent_unavailable") {
      issues.push({
        where: postId,
        detail: "부모 글이 없어 문맥이 잘려 있다 — 원문 직접 재사용 대상에서 뺀다",
        blocking: false,
      });
    }

    rows.push({
      post_id: postId,
      url: String(row.url ?? ""),
      author: String(row.author ?? ""),
      published_at: String(row.published_at ?? ""),
      body: row.body as string,
      format: (row.format as CorpusRow["format"]) ?? "text",
      content_funnel: String(row.content_funnel ?? ""),
      topic_tags: Array.isArray(row.topic_tags) ? (row.topic_tags as string[]) : [],
      permission_scope: row.permission_scope as string,
      source_method: row.source_method as string,
      extraction_status: status,
    });
  });

  return { rows, issues, ok: !issues.some((i) => i.blocking) };
}

/**
 * 패턴 라이브러리의 참조 무결성.
 *
 * 패턴이 가리키는 source_post_id가 코퍼스에 없으면, 그 패턴은 근거 없이
 * 떠 있는 스타일 지시가 된다. 그런 패턴으로 만든 초안은 "허가 코퍼스 기반"이라고
 * 말할 수 없다.
 */
export function validateLibrary(library: PatternLibrary, rows: CorpusRow[]): CorpusIssue[] {
  const issues: CorpusIssue[] = [];
  const known = new Set(rows.map((r) => r.post_id));

  if (!Array.isArray(library.patterns) || library.patterns.length === 0) {
    issues.push({ where: "patterns", detail: "패턴이 하나도 없다", blocking: true });
    return issues;
  }

  const seen = new Set<string>();
  for (const pattern of library.patterns) {
    const where = pattern.id ?? "(id 없음)";
    if (!pattern.id) {
      issues.push({ where: "patterns[]", detail: "id가 없는 패턴이 있다", blocking: true });
      continue;
    }
    if (seen.has(pattern.id)) {
      issues.push({ where, detail: "패턴 id 중복", blocking: true });
    }
    seen.add(pattern.id);

    if (!Array.isArray(pattern.source_post_ids) || pattern.source_post_ids.length === 0) {
      issues.push({ where, detail: "source_post_ids가 비어 있다", blocking: true });
      continue;
    }
    for (const id of pattern.source_post_ids) {
      if (!known.has(id)) {
        issues.push({
          where,
          detail: `코퍼스에 없는 source_post_id — ${id}`,
          blocking: true,
        });
      }
    }
    if (!pattern.hook_formula || !Array.isArray(pattern.body_formula)) {
      issues.push({ where, detail: "hook_formula / body_formula가 없다", blocking: true });
    }
    if (!pattern.love_rabbit_policy) {
      issues.push({ where, detail: "love_rabbit_policy가 없다 — 이 패턴을 쓸 조건이 비었다", blocking: true });
    }
  }

  // 라이브러리가 스스로 적어 둔 개수와 실제 코퍼스가 어긋나면 둘 중 하나가 낡았다.
  if (library.metadata?.corpus_post_count !== rows.length) {
    issues.push({
      where: "metadata.corpus_post_count",
      detail: `${library.metadata?.corpus_post_count}로 적혀 있는데 실제 코퍼스는 ${rows.length}개다`,
      blocking: false,
    });
  }

  return issues;
}

/**
 * 코퍼스 밖의 게시물 ID가 참조로 들어오는 것을 막는다.
 *
 * 지시 문서 E-5가 blocking으로 정한 항목이다. 허가는 corpus.v1.jsonl에 들어 있는
 * 열한 개에만 걸려 있고, 그 밖의 계정·게시물은 아무 근거가 없다.
 */
export function unknownSourceIds(ids: string[], rows: CorpusRow[]): string[] {
  const known = new Set(rows.map((r) => r.post_id));
  return [...new Set(ids)].filter((id) => !known.has(id));
}

/** 문맥이 온전해 원문 직접 재사용까지 허용되는 행 */
export function directCopyEligible(rows: CorpusRow[]): CorpusRow[] {
  return rows.filter((r) => r.extraction_status === "complete");
}

export function loadCorpus(rel = CORPUS_PATH): CorpusValidation {
  return parseCorpus(readCorpusText(rel));
}

export function loadLibrary(rel = LIBRARY_PATH): PatternLibrary {
  return JSON.parse(readLibraryText(rel)) as PatternLibrary;
}
