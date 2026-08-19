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
import { isDatabaseConfigured, saveUserSajuProfile } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";
import { lunarToSolar } from "@/lib/lunar";
import { computeSajuScore } from "@/lib/saju-score";
import { checkReport, guardRetryPrompt, type GuardViolation } from "@/lib/reading-guard";

export const maxDuration = 60;

interface PersonBody {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  gender: string;
  /** 입력한 날짜가 음력인지. 생략하면 양력으로 본다. */
  calendar?: "solar" | "lunar";
  /** 음력일 때만 의미가 있다 */
  leapMonth?: boolean;
}

interface Body {
  category: string; // 상품 카탈로그(products.ts)의 id
  offerId?: string; // 광고 전용 공개 오퍼. 서버에서 카테고리와 함께 검증한다.
  me: PersonBody;
  partner?: PersonBody | null;
  question?: string;
  userToken?: string;
}

interface PreviewSection {
  title: string;
  excerpt: string;
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

// 음력 입력을 양력으로 바꾼다. 사주 계산은 태양 위치 기반이라 양력이 아니면 성립하지 않는다.
// 변환은 반드시 서버에서 한다 — 클라이언트가 보낸 양력 값을 그대로 믿으면 검증을 우회할 수 있다.
function toSolar(person: PersonBody): { person: PersonBody; note: string | null } | null {
  if (person.calendar !== "lunar") return { person, note: null };
  const converted = lunarToSolar({
    year: person.year,
    month: person.month,
    day: person.day,
    leapMonth: person.leapMonth === true,
  });
  if (!converted) return null;
  return { person: { ...person, ...converted.solar, calendar: "solar" }, note: converted.note };
}

// 생년월일 유효성 — JS Date의 자동 환산(예: 22월 → 이듬해 10월)으로 엉터리 사주가 나가는 것을 차단
function isValidBirth(p: Body["me"] | NonNullable<Body["partner"]>): boolean {
  const { year, month, day, hour, gender } = p;
  const nowYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > nowYear) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false; // 2월 30일 등
  if (d.getTime() > Date.now()) return false; // 미래 날짜
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) return false;
  if (gender !== "F" && gender !== "M") return false;
  return true;
}

function isAdultBirth(p: Body["me"]): boolean {
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate());
  return new Date(p.year, p.month - 1, p.day).getTime() <= cutoff.getTime();
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

  // 음력이면 여기서 양력으로 바꾸고, 아래 검증부터는 전부 양력 값으로만 진행한다.
  const meSolar = toSolar(body.me);
  if (!meSolar) {
    return NextResponse.json(
      { error: "입력한 음력 날짜가 존재하지 않아요. 날짜와 윤달 여부를 확인해주세요." },
      { status: 400 }
    );
  }
  body.me = meSolar.person;

  let partnerNote: string | null = null;
  if (body.partner) {
    const partnerSolar = toSolar(body.partner);
    if (!partnerSolar) {
      return NextResponse.json(
        { error: "그 사람의 음력 날짜가 존재하지 않아요. 날짜와 윤달 여부를 확인해주세요." },
        { status: 400 }
      );
    }
    body.partner = partnerSolar.person;
    partnerNote = partnerSolar.note;
  }
  if (!isValidBirth(body.me)) {
    return NextResponse.json(
      { error: "내 생년월일이 올바르지 않아요. 연도(1900~)·월(1~12)·일(1~31)을 확인해주세요." },
      { status: 400 }
    );
  }
  if (!isAdultBirth(body.me)) {
    return NextResponse.json({ error: "만 19세 이상만 이용할 수 있어요." }, { status: 403 });
  }
  if (body.partner && !isValidBirth(body.partner)) {
    return NextResponse.json(
      { error: "그 사람 생년월일이 올바르지 않아요. 연도(1900~)·월(1~12)·일(1~31)을 확인해주세요." },
      { status: 400 }
    );
  }

  const offer = body.offerId ? resolveAdOffer(body.category, body.offerId) : null;
  if (body.offerId && !offer) {
    return NextResponse.json({ error: "유효하지 않은 광고 오퍼입니다." }, { status: 400 });
  }

  if (!user.userId) {
    return NextResponse.json(
      { error: "회원 정보를 연결하지 못했어요. 다시 로그인해주세요.", needSignup: true },
      { status: 401 }
    );
  }

  try {
    const birthdate = [
      String(body.me.year).padStart(4, "0"),
      String(body.me.month).padStart(2, "0"),
      String(body.me.day).padStart(2, "0"),
    ].join("-");
    await saveUserSajuProfile(user.userId, {
      birthdate,
      birthHour: body.me.hour,
      birthTimeUnknown: body.me.hour === null,
      gender: body.me.gender as "F" | "M",
    });
  } catch (error) {
    console.error("사주 기본 정보 저장 실패:", error);
    return NextResponse.json(
      { error: "입력한 사주 정보를 안전하게 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }

  const myChart = computeSaju(body.me);
  const partnerChart = body.partner ? computeSaju(body.partner) : null;
  const label = PRODUCT_MAP[body.category]?.promptLabel ?? "연애운";
  const price = priceFor(body.category ?? "", offer?.id);
  const product = PRODUCT_MAP[body.category];
  const now = new Date();

  // 계산은 여기서 끝난다. AI는 이 결과만 근거로 문장을 쓴다.
  const myFacts = buildSajuFacts({ ...body.me, gender: body.me.gender === "F" ? "F" : "M" }, now);
  const partnerFacts: SajuFacts | null = body.partner
    ? buildSajuFacts({ ...body.partner, gender: body.partner.gender === "F" ? "F" : "M" }, now)
    : null;

  // 음력으로 받은 날짜는 무엇을 무엇으로 바꿨는지 계산 노트에 남긴다.
  if (meSolar.note) myFacts.calculationNotes.unshift(meSolar.note);
  if (partnerNote && partnerFacts) partnerFacts.calculationNotes.unshift(partnerNote);

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
  // 출고 검사 결과 — 고치지 못한 위반은 blob에 남겨 나중에 되짚을 수 있게 한다
  let guardViolations: GuardViolation[] = [];

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

      // 스키마는 맞아도 내용이 선을 넘을 수 있다. 한 번 훑고, 막아야 할 위반이면 한 번만 다시 시킨다.
      if (report) {
        const guard = checkReport(report, { expectedSections: outline.length });
        guardViolations = guard.violations;
        if (guard.mustRetry) {
          console.warn(
            "리포트 출고 검사 위반:",
            guard.violations.filter((v) => v.blocking).map((v) => `${v.where} ${v.detail}`).join(" / ")
          );
          const fixed = await chatComplete(
            READING_SYSTEM_PROMPT,
            [
              { role: "user", content: userPrompt },
              { role: "assistant", content: JSON.stringify({ report_meta: report.meta }).slice(0, 1200) },
              { role: "user", content: guardRetryPrompt(guard.violations) },
            ],
            8000
          );
          const reparsed = fixed ? parseStructuredReport(fixed.text) : null;
          if (reparsed) {
            const recheck = checkReport(reparsed, { expectedSections: outline.length });
            // 고쳐서 나아졌을 때만 바꿔 끼운다 — 재요청이 더 나쁠 수도 있다
            if (!recheck.mustRetry || recheck.violations.length < guard.violations.length) {
              report = reparsed;
              guardViolations = recheck.violations;
            }
          }
        }
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
  // 지수는 명식에서 뽑는다 — 인자와 근거가 함께 나오고, 그대로 봉인해 해금 후 보여준다.
  const scoreResult = computeSajuScore(body.category, myFacts, partnerFacts);
  const score = scoreResult.value;
  const scoreBand = product?.meterLabels?.[scoreResult.bandIndex] ?? null;
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
    blob: seal({
      id,
      full,
      price,
      label,
      chart,
      score,
      scoreLabel,
      scoreBand,
      scoreFactors: scoreResult.factors,
      // 구조화 리포트를 통째로 봉인한다. 텍스트로 눌러 담으면 facts_used와
      // watch_out이 사라져, 나중에 "이 문장이 어디서 나왔나"를 되짚을 수 없다.
      report,
      // 고치지 못하고 내보낸 위반 — 사용자에게는 안 보이지만 감사할 수 있어야 한다
      guardViolations,
    }),
    demo: providerName === "demo",
    provider: providerName,
  });
}
