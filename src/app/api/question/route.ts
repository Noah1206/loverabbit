import { NextRequest, NextResponse } from "next/server";

import { getUserSajuProfile, isDatabaseConfigured } from "@/lib/database";
import {
  applyCredit,
  createQuestion,
  getCreditBalance,
  InsufficientCreditsError,
  listQuestions,
  listUnlockedReadingsForContext,
  settleQuestion,
} from "@/lib/credits-db";
import { QUESTION_COST } from "@/lib/credits";
import { answerQuestion } from "@/lib/question-answer";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

// 오늘의 질문 — 크레딧 5장.
//
// 순서가 중요하다. 질문 행 → 크레딧 차감 → 답 생성 → 답 저장. 생성이 실패하면
// 차감을 되돌린다(refund). 차감을 먼저 하는 이유는, 답을 먼저 만들고 차감이
// 실패하면 공짜 답이 나가기 때문이다. 되돌림의 ref 는 질문 id 라 두 번 되돌리지 않는다.

interface Body {
  userToken?: string;
  question?: string;
  /** 목록만 볼 때 */
  list?: boolean;
}

const MAX_QUESTION_LEN = 500;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "질문 DB 연결을 준비 중입니다." }, { status: 503 });
  }
  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("질문 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "질문하려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }
  const userId = user.userId;

  if (body.list) {
    const [balance, questions] = await Promise.all([getCreditBalance(userId), listQuestions(userId)]);
    return NextResponse.json({ balance, questions, cost: QUESTION_COST });
  }

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  if (question.length > MAX_QUESTION_LEN) {
    return NextResponse.json({ error: "질문이 너무 길어요. 500자 안으로 부탁해요." }, { status: 400 });
  }

  const [profile, readings] = await Promise.all([
    getUserSajuProfile(userId).catch(() => null),
    listUnlockedReadingsForContext(userId).catch(() => []),
  ]);

  const record = await createQuestion({ userId, question, readingIds: readings.map((r) => r.id) });
  if (!record) return NextResponse.json({ error: "질문을 저장하지 못했어요." }, { status: 503 });

  let balance: number;
  try {
    balance = await applyCredit(userId, -QUESTION_COST, "question", record.id);
  } catch (error) {
    await settleQuestion(record.id, { failed: true }).catch(() => {});
    if (error instanceof InsufficientCreditsError) {
      const current = await getCreditBalance(userId).catch(() => 0);
      return NextResponse.json(
        { error: "크레딧이 부족해요.", insufficient: true, balance: current, cost: QUESTION_COST },
        { status: 402 }
      );
    }
    console.error("질문 크레딧 차감 실패:", error);
    return NextResponse.json({ error: "크레딧을 처리하지 못했어요." }, { status: 503 });
  }

  try {
    const outcome = await answerQuestion(question, { profile, readings });
    if (!outcome) {
      // 데모 — AI 미설정. 크레딧은 되돌린다.
      const refunded = await applyCredit(userId, QUESTION_COST, "refund", record.id);
      await settleQuestion(record.id, { failed: true });
      return NextResponse.json({
        answer: "[데모 모드] 지금은 답을 만들 수 없어요. 크레딧은 돌려드렸어요.",
        demo: true,
        balance: refunded,
      });
    }
    await settleQuestion(record.id, { answer: outcome.answer });
    return NextResponse.json({ id: record.id, answer: outcome.answer, balance, provider: outcome.provider });
  } catch (error) {
    console.error("질문 답변 실패:", error);
    const refunded = await applyCredit(userId, QUESTION_COST, "refund", record.id).catch(() => balance);
    await settleQuestion(record.id, { failed: true }).catch(() => {});
    return NextResponse.json(
      { error: "답을 만들지 못했어요. 크레딧은 돌려드렸어요.", balance: refunded },
      { status: 502 }
    );
  }
}
