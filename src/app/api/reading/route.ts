import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { computeSaju, chartSummary } from "@/lib/saju";
import { buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import {
  READING_SYSTEM_PROMPT,
  buildReadingInput,
  buildReadingUserPrompt,
  parseStructuredReport,
  reportToText,
  type StructuredReport,
} from "@/lib/reading-prompt";
import { saveReading, priceFor } from "@/lib/store";
import { seal } from "@/lib/crypto";
import { chatComplete } from "@/lib/ai";
import { PRODUCT_MAP } from "@/lib/products";
import { resolveAdOffer } from "@/lib/ad-offers";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

interface Body {
  category: string; // 상품 카탈로그(products.ts)의 id
  offerId?: string; // 광고 전용 공개 오퍼. 서버에서 카테고리와 함께 검증한다.
  me: { year: number; month: number; day: number; hour: number | null; gender: string };
  partner?: { year: number; month: number; day: number; hour: number | null; gender: string } | null;
  question?: string;
  userToken?: string;
}

interface PreviewSection {
  title: string;
  excerpt: string;
}

// 지수(게이지) — 명식에서 결정적으로 산출 (같은 사주면 항상 같은 값, 55~95)
function scoreFrom(me: string, partner: string | null): number {
  let h = 0;
  for (const ch of me + (partner ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 55 + (h % 41);
}

function mockReading(category: string): { teaser: string; full: string } {
  const label = PRODUCT_MAP[category]?.promptLabel ?? "연애운";
  return {
    teaser: `[데모 모드] 네 일간을 보니까… 겉으론 차가운 척하는데 속은 한번 불붙으면 끝을 보는 타입이네. ${label} 흐름에 지금 큰 변곡점이 하나 보이는데, 문제는 네가 그걸 스스로 걷어차기 직전이라는 거야. 어디서부터 꼬였는지, 풀 리딩에서 다 말해줄게.`,
    full: `[데모 모드 — .env에 API 키를 설정하면 실제 AI 리딩이 생성됩니다]\n\n■ 너의 연애 기질\n네 일주 조합은 은근히 주도권을 쥐고 싶어하는 타입이야. 겉으론 맞춰주는 척, 속으론 상황을 꼼꼼히 살피는 편이지.\n\n■ 그 사람과의 합\n오행 상 너희 둘은 목생화(木生火) 관계 — 한쪽의 관심이 다른 쪽의 마음을 빠르게 키우는 조합이야. 다만 감정 속도도 빠르니 완급이 관건.\n\n■ 주의할 구간\n올해 10~11월, 지지끼리 충(沖)이 걸리는 구간이 있어. 이 시기에 나오는 말들은 진심보다 순간 감정에 가까울 수 있으니 한 번 더 생각해.\n\n■ 지금 움직이는 법\n먼저 연락하기보다 상대의 반응을 조금 더 살펴봐. 네 사주는 기다릴 때 흐름이 유리해지는 구조야. 3주 정도 여유를 둬.`,
  };
}

function previewOf(full: string, fallbackTitles: string[]): {
  sections: PreviewSection[];
  lockedTitles: string[];
} {
  const parsed = full
    .split(/(?:^|\n)\s*■\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      const title = lines[0].trim();
      const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
      const sentences = body.match(/[^.!?。]+[.!?。]?/g) ?? [body];
      return {
        title,
        excerpt: sentences.slice(0, 2).join(" ").trim().slice(0, 360),
      };
    })
    .filter((section) => section.title && section.excerpt);

  const plainSentences = full
    .replace(/(?:^|\n)\s*■\s*[^\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?。]+[.!?。]?/g) ?? [];
  const source = parsed.length >= 3
    ? parsed
    : fallbackTitles.slice(0, 3).map((title, index) => ({
        title,
        excerpt: plainSentences.slice(index * 2, index * 2 + 2).join(" ").trim().slice(0, 360),
      })).filter((section) => section.excerpt);
  // 위의 3~4문장 티저와 합쳐 무료 공개 분량이 약 10문장이 되도록
  // 목차별 미리보기는 최대 3개 섹션, 각 2문장까지만 내려보낸다.
  const sections = source.slice(0, 3);
  return {
    sections,
    lockedTitles: source.slice(3).map((section) => section.title),
  };
}

// 생년월일 유효성 — JS Date의 자동 환산(예: 22월 → 이듬해 10월)으로 엉터리 사주가 나가는 것을 차단
function isValidBirth(p: Body["me"] | NonNullable<Body["partner"]>): boolean {
  const { year, month, day, hour } = p;
  const nowYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > nowYear) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false; // 2월 30일 등
  if (d.getTime() > Date.now()) return false; // 미래 날짜
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) return false;
  return true;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  if (!body.userToken) {
    return NextResponse.json(
      { error: "무료 사주를 보려면 먼저 로그인해주세요.", needSignup: true },
      { status: 401 }
    );
  }

  let user: Awaited<ReturnType<typeof resolveUserToken>>;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("무료 미리보기 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json(
      { error: "로그인 정보가 만료됐어요. 다시 로그인해주세요.", needSignup: true },
      { status: 401 }
    );
  }

  if (!body?.me?.year || !body?.me?.month || !body?.me?.day) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
  }
  if (!isValidBirth(body.me)) {
    return NextResponse.json(
      { error: "내 생년월일이 올바르지 않아요. 연도(1900~)·월(1~12)·일(1~31)을 확인해주세요." },
      { status: 400 }
    );
  }
  if (body.partner && !isValidBirth(body.partner)) {
    return NextResponse.json(
      { error: "그 사람 생년월일이 올바르지 않아요. 연도(1900~)·월(1~12)·일(1~31)을 확인해주세요." },
      { status: 400 }
    );
  }

  const myChart = computeSaju(body.me);
  const partnerChart = body.partner ? computeSaju(body.partner) : null;
  const offer = body.offerId ? resolveAdOffer(body.category, body.offerId) : null;
  if (body.offerId && !offer) {
    return NextResponse.json({ error: "유효하지 않은 광고 오퍼입니다." }, { status: 400 });
  }
  const label = PRODUCT_MAP[body.category]?.promptLabel ?? "연애운";
  const price = priceFor(body.category ?? "", offer?.id);
  const product = PRODUCT_MAP[body.category];
  const now = new Date();

  // 계산은 여기서 끝난다. AI는 이 결과만 근거로 문장을 쓴다.
  const myFacts = buildSajuFacts({ ...body.me, gender: body.me.gender === "F" ? "F" : "M" }, now);
  const partnerFacts: SajuFacts | null = body.partner
    ? buildSajuFacts({ ...body.partner, gender: body.partner.gender === "F" ? "F" : "M" }, now)
    : null;

  const outline = product?.toc ?? ["나의 핵심 결", "관계의 결", "지금의 흐름"];
  const userPrompt = buildReadingUserPrompt(
    buildReadingInput({
      facts: myFacts,
      partnerFacts,
      productLabel: label,
      outline,
      focus: partnerFacts ? "relationship" : "self",
      currentScene: body.question ?? "",
      characterId: null,
      characterName: null,
      now,
    })
  );

  let teaser: string;
  let full: string;
  let report: StructuredReport | null = null;
  let providerName = "demo";

  try {
    const result = await chatComplete(READING_SYSTEM_PROMPT, [{ role: "user", content: userPrompt }], 8000);
    if (!result) {
      ({ teaser, full } = mockReading(body.category));
    } else {
      providerName = result.provider;
      report = parseStructuredReport(result.text);

      // JSON이 깨져 나오는 경우가 있어 한 번만 다시 청한다.
      if (!report) {
        const retry = await chatComplete(
          READING_SYSTEM_PROMPT,
          [
            { role: "user", content: userPrompt },
            { role: "assistant", content: result.text.slice(0, 2000) },
            {
              role: "user",
              content: "출력이 스키마에 맞지 않았어. 설명 없이 지정 JSON 객체 하나만 다시 출력해.",
            },
          ],
          8000
        );
        report = retry ? parseStructuredReport(retry.text) : null;
      }

      if (report) {
        ({ teaser, full } = reportToText(report));
      } else {
        console.error("리포트 JSON 파싱 실패 — 데모로 폴백");
        ({ teaser, full } = mockReading(body.category));
        providerName = "demo";
      }
    }
  } catch (e) {
    console.error("AI 호출 실패, 데모로 폴백:", e);
    ({ teaser, full } = mockReading(body.category));
  }

  // 풀 리딩은 서버에만 저장 — 결제 확인(/api/unlock) 후에만 내려간다.
  const chart = {
    me: chartSummary(myChart),
    partner: partnerChart ? chartSummary(partnerChart) : null,
  };
  const score = scoreFrom(chart.me, chart.partner);
  const scoreLabel = product?.scoreLabel ?? null;
  const id = randomUUID();
  // 운영에서는 반드시 Supabase에 저장하고, 로컬 무설정 환경만 파일 저장소를 쓴다.
  try {
    await saveReading({
      id,
      // 무료 리딩부터 로그인한 사용자에게 귀속한다.
      userId: user.userId,
      createdAt: new Date().toISOString(),
      category: body.category,
      teaser,
      full,
      chart,
      provider: providerName,
      price,
      score,
      scoreLabel,
      unlocked: false,
    });
  } catch (e) {
    console.error("리딩 저장 실패:", e);
    if (isDatabaseConfigured() || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "리딩을 안전하게 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }
  }

  // 무료 공개분: 첫 섹션은 읽히고, 둘째 섹션은 흐려지며 끊기고, 나머지는 제목만 목차에 남는다.
  const preview = report
    ? {
        sections: report.sections.slice(0, 2).map((section) => ({
          title: section.title,
          excerpt: section.summary.slice(0, 360),
        })),
        lockedTitles: report.sections.slice(2).map((section) => section.title),
      }
    : previewOf(full, product?.toc ?? ["명식 분석", "기질 분석", "시기 판단", "행동 가이드"]);
  return NextResponse.json({
    readingId: id,
    teaser,
    chart,
    price,
    offerId: offer?.id ?? null,
    landingType: offer?.landingType ?? null,
    // 섹션별 핵심만 공개한다. 실제 나머지 원문은 서버 밖으로 보내지 않는다.
    previewSections: preview.sections,
    lockedSectionTitles: preview.lockedTitles,
    // 잠금 상태에선 지수 라벨만 노출 — 실제 지수는 blob에 봉인, 해금 시 공개
    scoreLabel,
    // 결제 전에도 보여주는 구조 정보 — 요약 카드와 고지는 유료 본문이 아니다
    headline: report?.meta.headline ?? null,
    summaryCards: report?.summaryCards ?? [],
    disclaimer: report?.meta.disclaimer ?? "오락 및 자기성찰을 위한 참고 해석이에요.",
    confidenceNote: report?.meta.confidenceNote ?? "",
    // 봉인된 풀 리딩 — 서버 키 없이는 열 수 없고, /api/unlock에서 결제 확인 후 복호화된다.
    // label·chart는 추가 상담(/api/chat)의 컨텍스트로 재사용된다.
    blob: seal({ id, full, price, label, chart, score, scoreLabel }),
    demo: providerName === "demo",
    provider: providerName,
  });
}
