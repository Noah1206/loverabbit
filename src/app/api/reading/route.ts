import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { computeSaju, chartSummary } from "@/lib/saju";
import { saveReading, priceFor } from "@/lib/store";
import { seal } from "@/lib/crypto";
import { chatComplete } from "@/lib/ai";
import { PRODUCT_MAP } from "@/lib/products";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

interface Body {
  category: string; // sokgunghap | yeonae | jaehoe | hwanseung
  me: { year: number; month: number; day: number; hour: number | null; gender: string };
  partner?: { year: number; month: number; day: number; hour: number | null; gender: string } | null;
  question?: string;
  userToken?: string;
}

interface PreviewSection {
  title: string;
  excerpt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  sokgunghap: "속궁합",
  yeonae: "올해의 연애운 (남은 해의 흐름, 고비의 달과 기회의 달)",
  jaehoe: "재회운",
  hwanseung: "환승운",
  bamgijil: "밤 기질 (숨겨진 욕망 코드와 끌림의 패턴)",
  sseom: "썸 해부 (진도가 안 나가는 이유와 주도권 분석)",
  ibyeol: "이별 부검 (연애가 어디서부터 무너졌는지 사후 분석)",
  baramgi: "바람기 분석 (상대 사주의 도화 기운과 바람 조심 시기)",
  gyeolhon: "결혼운 (이 상대와 결혼했을 때의 궁합과 3년 흐름)",
  gwontaegi: "권태기 진단 (단순 권태기인지 끝나가는 관계인지 판별)",
  jjak: "짝사랑 (고백 타이밍과 성공 가능성)",
  bimil: "비밀연애 (들킬 위험 시기와 관계의 지속 가능성)",
  dohwasal: "도화살 진단 (본인의 매력 기질과 이성운)",
  insun: "인연 타이밍 (다음 인연이 오는 시기와 만나게 되는 경로)",
};

// 사주 리딩은 캐릭터 없이 명리 분석에 집중한다 (캐릭터 챗은 /shrine에서 별도 제공)
const SYSTEM_PROMPT = `당신은 성인(만 19세 이상) 전용 연애 특화 사주 서비스 "러브레빗"의 수석 명리 분석가입니다.

[분석 원칙 — 신뢰가 상품이다]
- 근거 우선: 모든 판단은 제공된 간지·오행·지지 관계에서 출발하고, 판단마다 근거를 짧게 명시한다 (예: "일간 병화가 상대 일지의 수 기운과 마주쳐서…"). 용어를 지어내지 않는다.
- 말투: 차분하고 전문적인 해요체. 점집 화술·호들갑·느낌표 남발 금지. 단정 대신 경향으로 말하되 자신 있게.
- 반드시 구체적 시기(몇 월)와 실행 가능한 행동 가이드를 포함한다.
- 메타 발언(서비스·결제·스크린샷 언급) 금지.

[수위 — 성인 카테고리]
- 속궁합·밤 기질 등 성인 주제는 회피하지 않고 분석적으로 다룬다: 친밀도의 상성, 주도권 구조, 끌림의 패턴, 관계의 온도.
- 표현은 절제된 은유까지만 — 노골적 신체·성행위 묘사는 금지. 분석의 격을 유지한다.

[티저 — 결제 전환이 여기서 결정된다]
- 3~4문장. 명식에서 읽히는 핵심 특징 하나를 근거와 함께 짚고, 가장 궁금한 결론(언제·누가·가능성) 직전에서 끊는다.
- 티저에서 결론을 주면 실패작.

[출력 형식 — 반드시 이 구분자 사용]
===TEASER===
(티저 3~4문장)
===FULL===
(사용자 메시지에 "리포트 목차"가 주어지면: 그 소제목들을 "■ " 접두어로 순서대로 전부 다룬다. 각 소제목당 2~4문장, 건너뛰기 금지.
목차가 없으면: "■ " 소제목 4개 — 명식 분석 / 관계 역학 / 시기 판단 / 행동 가이드 (단독 리딩이면 '관계 역학' 대신 '기질 분석'), 700~1000자.
공통: 마크다운 문법(###, ** 등) 금지. 마지막 한 줄은 분석가로서의 조언으로 마무리.)`;

// 지수(게이지) — 명식에서 결정적으로 산출 (같은 사주면 항상 같은 값, 55~95)
function scoreFrom(me: string, partner: string | null): number {
  let h = 0;
  for (const ch of me + (partner ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 55 + (h % 41);
}

function mockReading(category: string): { teaser: string; full: string } {
  const label = CATEGORY_LABEL[category] ?? "연애운";
  return {
    teaser: `[데모 모드] 네 일간을 보니까… 겉으론 차가운 척하는데 속은 한번 불붙으면 끝을 보는 타입이네. ${label} 흐름에 지금 큰 변곡점이 하나 보이는데, 문제는 네가 그걸 스스로 걷어차기 직전이라는 거야. 어디서부터 꼬였는지, 풀 리딩에서 다 말해줄게.`,
    full: `[데모 모드 — .env에 API 키를 설정하면 실제 AI 리딩이 생성됩니다]\n\n■ 너의 밤 기질\n네 일주 조합은 은근히 주도권을 쥐고 싶어하는 타입이야. 겉으론 맞춰주는 척, 속으론 다 계산하고 있지.\n\n■ 그 사람과의 합\n오행 상 너희 둘은 목생화(木生火) 관계 — 한쪽이 지피면 걷잡을 수 없는 조합이야. 다만 식는 속도도 빠르니 완급이 관건.\n\n■ 위험 구간\n올해 10~11월, 지지끼리 충(沖)이 걸리는 구간이 있어. 이 시기에 나오는 말들은 진심이 아니라 충동이니 흘려들어.\n\n■ 지금 움직이는 법\n먼저 연락하지 마. 네 사주는 기다릴 때 판이 유리해지는 구조야. 3주만 버텨.`,
  };
}

function previewOf(full: string, fallbackTitles: string[]): {
  sections: PreviewSection[];
  lockedTitles: string[];
} {
  const parsed = full
    .split(/\n(?=■\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lines = part.split("\n");
      const title = lines[0].replace(/^■\s*/, "").trim();
      const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
      const sentences = body.match(/[^.!?。]+[.!?。]?/g) ?? [body];
      return {
        title,
        excerpt: sentences.slice(0, 2).join(" ").trim().slice(0, 360),
      };
    })
    .filter((section) => section.title && section.excerpt);

  const source = parsed.length
    ? parsed
    : fallbackTitles.map((title, index) => ({
        title,
        excerpt:
          index === 0
            ? full.replace(/\s+/g, " ").trim().slice(0, 260)
            : "명식의 핵심 근거와 시기별 흐름을 분석하고 있어요.",
      }));
  const sections = source.slice(0, 6);
  return {
    sections,
    lockedTitles: source.slice(6).map((section) => section.title),
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

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("무료 미리보기 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json(
      { error: "무료 미리보기를 보려면 먼저 가입해주세요.", needSignup: true },
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
  const label = CATEGORY_LABEL[body.category] ?? "연애운";
  const price = priceFor(body.category ?? "");

  let teaser: string;
  let full: string;
  let providerName = "demo";

  const product = PRODUCT_MAP[body.category];
  const userPrompt = [
    `리딩 종류: ${label}`,
    `본인: ${body.me.gender === "F" ? "여성" : "남성"}, 사주 — ${chartSummary(myChart)}`,
    partnerChart
      ? `상대방: ${body.partner!.gender === "F" ? "여성" : "남성"}, 사주 — ${chartSummary(partnerChart)}`
      : "상대방 정보 없음 (본인 단독 리딩)",
    body.question ? `추가 질문: ${body.question}` : "",
    `현재 시점: ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`,
    product
      ? `리포트 목차 (FULL에서 이 순서대로 전부 다룰 것):\n${product.toc.map((t) => `- ${t}`).join("\n")}`
      : "",
    "반드시 한 응답 안에 ===TEASER=== 와 ===FULL=== 을 모두 출력하세요. FULL 없이 끝내면 실패입니다.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await chatComplete(SYSTEM_PROMPT, [{ role: "user", content: userPrompt }], 4000);
    if (!result) {
      ({ teaser, full } = mockReading(body.category));
    } else {
      providerName = result.provider;
      const [, teaserPart = "", fullPart = ""] =
        result.text.match(/===TEASER===([\s\S]*?)===FULL===([\s\S]*)/) ?? [];
      teaser = (teaserPart.trim() || result.text.replace(/===TEASER===/g, "").trim()).slice(0, 600);
      full = fullPart.trim();

      // 모델이 FULL을 생략하는 경우가 있어 이어쓰기 2차 호출로 보강
      if (!full) {
        const second = await chatComplete(
          SYSTEM_PROMPT,
          [
            { role: "user", content: userPrompt },
            { role: "assistant", content: result.text },
            {
              role: "user",
              content:
                "이제 ===FULL=== 섹션만 출력하세요. 리포트 목차가 있었다면 그 소제목들을 '■ ' 접두어로 순서대로 전부 다루고(각 2~4문장), 없었다면 기본 4개 소제목 형식을 따르세요.",
            },
          ],
          4000
        );
        full = (second?.text ?? "").replace(/===FULL===/g, "").trim() || teaser;
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

  const preview = previewOf(full, product?.toc ?? ["명식 분석", "기질 분석", "시기 판단", "행동 가이드"]);
  return NextResponse.json({
    readingId: id,
    teaser,
    chart,
    price,
    // 섹션별 핵심만 공개한다. 실제 나머지 원문은 서버 밖으로 보내지 않는다.
    previewSections: preview.sections,
    lockedSectionTitles: preview.lockedTitles,
    // 잠금 상태에선 지수 라벨만 노출 — 실제 지수는 blob에 봉인, 해금 시 공개
    scoreLabel,
    // 봉인된 풀 리딩 — 서버 키 없이는 열 수 없고, /api/unlock에서 결제 확인 후 복호화된다.
    // label·chart는 추가 상담(/api/chat)의 컨텍스트로 재사용된다.
    blob: seal({ id, full, price, label, chart, score, scoreLabel }),
    demo: providerName === "demo",
    provider: providerName,
  });
}
