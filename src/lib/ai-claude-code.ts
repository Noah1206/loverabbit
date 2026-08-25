// Claude Code CLI 를 제공사처럼 쓴다.
//
// 왜 SDK 가 아니라 CLI 인가. ANTHROPIC_API_KEY 로 호출하면 구독이 아니라 API
// 종량과금으로 청구된다. 둘은 다른 지갑이다. 구독으로 문장을 만들게 하려면
// 이미 로그인된 Claude Code 를 헤드리스(-p)로 부르는 길뿐이다.
//
// 그래서 이 파일은 HTTP 를 짜지 않는다. 프로세스를 하나 띄우고 stdout 을 읽는다.
//
// 주의할 것 셋.
//
//  1. 도구를 주지 않는다. 문장만 받으면 되는데 파일을 읽고 쓸 수 있게 두면,
//     생성기가 저장소를 건드릴 길이 생긴다.
//  2. 프롬프트를 인자로 넘기지 않는다. 사용자 프롬프트는 stdin 으로, 시스템
//     프롬프트는 파일로 준다. 처음에는 --append-system-prompt 에 문자열로 넘겼는데,
//     짧은 시험에서는 통과하고 실제 생성에서 깨졌다 — 규칙 표와 원문이 들어간
//     프롬프트는 줄바꿈과 따옴표가 많아 Windows 명령줄에서 인용이 무너진다.
//  3. 시간 제한을 둔다. 응답이 안 오면 배치가 밤새 매달려 있는다.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ChatMsg, ChatResult } from "@/lib/ai";

/** 한 번 호출에 기다릴 시간. 초안 하나가 이보다 오래 걸리면 뭔가 잘못된 것이다. */
const TIMEOUT_MS = Number(process.env.CLAUDE_CODE_TIMEOUT_MS ?? 180_000);

/**
 * 실행 파일을 직접 가리킨다.
 *
 * shell: true 로 claude.cmd 를 거치면 인자가 cmd 파서를 한 번 더 지나고, 거기서
 * 우리 프롬프트가 깨진다. CLAUDE_CODE_BIN 으로 덮어쓸 수 있게 두되, 기본값은
 * npm 전역 설치 위치의 실행 파일이다. 없으면 PATH 의 이름으로 떨어진다.
 */
function claudeBin(): string {
  const override = process.env.CLAUDE_CODE_BIN;
  if (override) return override;
  if (process.platform !== "win32") return "claude";

  const guess = path.join(
    process.env.APPDATA ?? "",
    "npm",
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    "claude.exe"
  );
  return fs.existsSync(guess) ? guess : "claude.cmd";
}

interface CliEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * 멀티턴을 한 덩어리 텍스트로 편다.
 *
 * CLI 는 대화 이력을 인자로 받지 않는다. 우리 생성기는 재시도할 때 앞 응답과
 * 지적을 함께 넘기므로, 그 맥락을 잃지 않도록 역할을 표시해 이어 붙인다.
 */
function flatten(messages: ChatMsg[]): string {
  if (messages.length === 1) return messages[0].content;
  return messages
    .map((m) => (m.role === "user" ? `[사용자]\n${m.content}` : `[이전 응답]\n${m.content}`))
    .join("\n\n");
}

async function runClaudeCode(
  system: string,
  messages: ChatMsg[],
  modelOverride?: string
): Promise<ChatResult> {
  const model = modelOverride ?? process.env.CLAUDE_CODE_MODEL ?? "sonnet";

  // 시스템 프롬프트는 파일로 넘긴다. 파일 이름에 무작위를 넣어, 같은 순간에
  // 두 생성이 돌아도 서로의 프롬프트를 덮지 않게 한다.
  const promptFile = path.join(
    os.tmpdir(),
    `lr-system-${process.pid}-${Math.random().toString(36).slice(2, 10)}.txt`
  );
  fs.writeFileSync(promptFile, system, "utf8");

  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    model,
    // 도구 없이 문장만 만든다.
    "--allowed-tools",
    "",
    "--append-system-prompt-file",
    promptFile,
  ];

  const bin = claudeBin();
  const child = spawn(bin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    // 셸을 거치지 않는다. 거치면 인자가 cmd 파서를 한 번 더 지나며 깨진다.
    shell: bin.endsWith(".cmd"),
  });

  let out = "";
  let err = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (out += chunk));
  child.stderr.on("data", (chunk: string) => (err += chunk));

  child.stdin.end(flatten(messages), "utf8");

  const code = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude 응답이 ${TIMEOUT_MS / 1000}초 안에 오지 않았다`));
    }, TIMEOUT_MS);

    child.on("error", (reason) => {
      clearTimeout(timer);
      reject(
        new Error(
          `claude 를 실행하지 못했다: ${reason.message} — Claude Code 가 설치되고 로그인돼 있어야 한다`
        )
      );
    });
    child.on("close", (value) => {
      clearTimeout(timer);
      resolve(value ?? 1);
    });
  });

  fs.rmSync(promptFile, { force: true });

  if (code !== 0) {
    throw new Error(`claude 가 코드 ${code} 로 끝났다: ${(err || out).slice(0, 300)}`);
  }

  let envelope: CliEnvelope;
  try {
    envelope = JSON.parse(out) as CliEnvelope;
  } catch {
    throw new Error(`claude 응답을 읽을 수 없다: ${out.slice(0, 300)}`);
  }
  if (envelope.is_error || typeof envelope.result !== "string") {
    throw new Error(`claude 가 오류를 돌려줬다: ${envelope.subtype ?? ""} ${envelope.result ?? ""}`);
  }

  return {
    text: envelope.result,
    provider: "claude-code",
    model: envelope.model ?? model,
    usage: {
      input: envelope.usage?.input_tokens ?? 0,
      output: envelope.usage?.output_tokens ?? 0,
      cached: envelope.usage?.cache_read_input_tokens ?? 0,
      reasoning: 0,
    },
  };
}

/**
 * 동시에 띄우는 CLI 수를 묶는다.
 *
 * 리딩 하나가 장(章) 일곱을 한꺼번에 부르는데, 헤드리스 claude 를 그만큼 동시에
 * 띄우면 하나도 제때 돌아오지 않았다 (2026-08-26, 전부 180초 타임아웃). 혼자
 * 부르면 30초대다. 둘씩 보내면 순서대로 다 온다.
 */
const CONCURRENCY = Math.max(1, Number(process.env.CLAUDE_CODE_CONCURRENCY ?? 2));
let running = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (running < CONCURRENCY) {
    running += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(() => { running += 1; resolve(); }));
}

function release(): void {
  running -= 1;
  waiting.shift()?.();
}

export async function callClaudeCode(
  system: string,
  messages: ChatMsg[],
  modelOverride?: string
): Promise<ChatResult> {
  await acquire();
  try {
    return await runClaudeCode(system, messages, modelOverride);
  } finally {
    release();
  }
}
