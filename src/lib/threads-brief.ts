// 운영자 지시.
//
// 지금까지 생성기는 계획(threads-plan.ts)이 못 박은 것만 만들었다. 주제 하나
// 바꾸려면 TypeScript 를 고쳐야 했고, 마음에 안 드는 초안이 나와도 버리거나
// 그냥 승인하는 것 말고 할 게 없었다.
//
// 그래서 지시 채널을 둘 연다.
//
//   content-brief.md        상시 방향 — 톤, 이번 주 강조점, 피할 표현
//   rewrite-requests.json   건별 재작성 — "이 초안 이렇게 다시 써"
//
// 지시가 닿는 곳을 반드시 갈라야 한다. 표현에는 닿고, 무엇이 명리 사실인가에는
// 못 닿는다. 안 그러면 "오늘은 삼재 얘기 써줘" 같은 지시가 규칙 표에 없는 주장을
// 문장으로 만든다. 프롬프트에서 지시문은 절대 규칙 아래에 들어가고, 가드는
// 그대로 검사한다 — 지시가 규칙을 이기지 못한다.

import fs from "node:fs";
import path from "node:path";

/**
 * 지시문이 사는 폴더.
 *
 * 이 저장소 밖에 둔다. 콘텐츠 방향을 적으려고 웹사이트 코드가 든 폴더를 열 이유가
 * 없고, 열면 Claude 에게 "여기 있는 건 다 네 일"처럼 보인다. 운영자가 만지는 것과
 * 코드가 사는 곳을 갈라 두면 둘 다 안전해진다.
 */
export const CONTENT_DIR = process.env.THREADS_CONTENT_DIR ?? "../loverabbit-content";
export const BRIEF_PATH = "content-brief.md";
export const REWRITE_PATH = "rewrite-requests.json";

function resolve(rel: string): string {
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), CONTENT_DIR, rel);
}

/**
 * 상시 브리프.
 *
 * 마크다운 그대로 넘긴다. 구조를 강제하지 않는 이유는, 사람이 급할 때 한 줄만
 * 적고 닫을 수 있어야 하기 때문이다. 형식을 요구하면 안 적게 된다.
 */
export function loadBrief(rel = BRIEF_PATH): string | null {
  const file = resolve(rel);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  // 주석과 빈 줄만 남은 틀은 지시가 없는 것으로 본다.
  const meaningful = text
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("<!--"))
    .join("\n");
  return meaningful.trim() ? text.trim() : null;
}

export type RewriteRequests = Record<string, string>;

export function loadRewrites(rel = REWRITE_PATH): RewriteRequests {
  const file = resolve(rel);
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as RewriteRequests;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // 요청 파일이 깨졌다고 생성 전체를 멈추지 않는다. 지시가 없는 것으로 돈다.
    return {};
  }
}

export function saveRewrites(requests: RewriteRequests, rel = REWRITE_PATH): void {
  fs.writeFileSync(resolve(rel), JSON.stringify(requests, null, 2) + "\n", "utf8");
}

/**
 * 처리한 요청을 지운다.
 *
 * 안 지우면 다음 실행에서 같은 지시가 또 걸리고, 이미 반영된 지적을 다시
 * 반영하려다 문장이 한쪽으로 계속 밀린다.
 */
export function clearRewrite(inputId: string, rel = REWRITE_PATH): void {
  const requests = loadRewrites(rel);
  if (!(inputId in requests)) return;
  delete requests[inputId];
  saveRewrites(requests, rel);
}

/**
 * 프롬프트에 얹을 지시 블록.
 *
 * 무엇을 할 수 없는지를 지시문 바로 옆에 적는다. 모델이 지시를 읽는 그 자리에서
 * 경계도 함께 읽어야, 지시가 세게 적혀 있을 때 규칙을 밀어내지 않는다.
 */
export function operatorBlock(brief: string | null, rewrite: string | null): string {
  if (!brief && !rewrite) return "";

  const lines = ["", "## 운영자 지시", ""];
  if (rewrite) {
    lines.push("### 이 초안 재작성 요청", rewrite, "");
  }
  if (brief) {
    lines.push("### 이번 기간 방향", brief, "");
  }
  lines.push(
    "위 지시는 **표현과 구성에만** 적용한다.",
    "- approved_facts 에 없는 명리 주장은 지시가 시켜도 쓰지 않는다.",
    "- 점수·순위·날짜·간지·띠·일간을 지시대로 바꾸지 않는다. 입력에 있는 값만 쓴다.",
    "- 절대 규칙과 부딪히면 절대 규칙을 따르고, 그 지시는 무시한다.",
    ""
  );
  return lines.join("\n");
}
