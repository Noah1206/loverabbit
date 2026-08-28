import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { computeSaju, chartSummary } from "@/lib/saju";
import { buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import {
  READING_PROMPT_VERSION,
  reportToText,
  type StructuredReport,
} from "@/lib/reading-prompt";
import { planImagesFor } from "@/lib/reading-asset-plan";
import { saveImageState } from "@/lib/reading-image-store";
import { pickIllustrated } from "@/lib/reading-images";
import { saveReading, priceFor } from "@/lib/store";
import { resolveBundle } from "@/lib/bundles";
import { seal } from "@/lib/crypto";
import { chatComplete, effectiveProvider, isAiConfigured } from "@/lib/ai";
import { demoReport, hasDemoReport } from "@/lib/reading-demo";
import { PRODUCT_MAP } from "@/lib/products";
import { resolveAdOffer } from "@/lib/ad-offers";
import { hasPaidReadingOrder, isDatabaseConfigured, saveUserSajuProfile } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";
import { lunarToSolar } from "@/lib/lunar";
import { computeSajuScore, sealScore } from "@/lib/saju-score";
import { checkReport, flaggedSections, type GuardViolation } from "@/lib/reading-guard";
import { forbiddenFromRules, matchRules } from "@/lib/reading-rules";
import { scopeOutline } from "@/lib/reading-scope";
import {
  composeReport,
  continuityFromReport,
  previewBatchCount,
  previewSections,
  rewriteFlagged,
} from "@/lib/reading-compose";
import { saveResume } from "@/lib/reading-resume";
import { PAY_BEFORE_GENERATE } from "@/lib/reading-gate";
import { recordAiUsage } from "@/lib/ai-usage";

// 조각을 동시에 던지므로 벽시계 시간은 가장 느린 조각 하나다. 그래도 60초는
// 여유가 없어, 재시도가 한 번 붙으면 함수가 먼저 끊긴다.
export const maxDuration = 300;

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
  bundleId?: string; // 세트(bundles.ts). 카테고리가 세트의 first 일 때만 받는다.
  me: PersonBody;
  partner?: PersonBody | null;
  question?: string;
  /**
   * 사용자가 적은 직업. 없어도 된다.
   * 계산에는 들어가지 않는다 — 해석의 장면을 고르는 데만 쓴다.
   */
  occupation?: string;
  userToken?: string;
}

interface PreviewSection {
  title: string;
  excerpt: string;
}

/**
 * 데모일 때 생성 블록을 건너뛰는 신호.
 *
 * 조건문으로 감싸지 않고 예외로 빠져나오는 이유: 생성 블록이 try 안에서 100줄 가까이
 * 이어지고 중간에 재시도·가드·폴백이 얽혀 있다. 그걸 통째로 들여쓰기 한 칸 밀면
 * 무엇이 바뀌었는지 diff 로 못 읽는다. 이 예외는 아래 catch 에서 조용히 지나간다.
 */
class SkipGeneration extends Error {}

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

  /*
    무료 미리보기는 로그인 없이 만든다 (2026-08-25).

    예전에는 여기서 토큰이 없으면 401 을 냈고, 폼은 아홉 칸을 다 채운 사람에게
    마지막에 가입 팝업을 띄웠다. 퍼널을 재 보니 그 칸까지 온 4명 중 3명이 거기서
    나갔다 - 하루 결제 0건의 직접 원인이었다. 이제 로그인은 전문(결제) 앞에서만
    묻는다. 주인 없는 리딩은 user_id 가 비어 기기 보관함에만 살고, 결제를 시작할
    때 claimReading 으로 그 계정에 붙는다.

    토큰이 왔는데 만료됐으면 익명으로 이어 간다. 여기서 막으면 "로그인했다고
    믿는" 사람이 빈손으로 튕기고, 어차피 결제 앞에서 다시 로그인하며 리딩이
    붙는다.
  */
  let user: Awaited<ReturnType<typeof resolveUserToken>> = null;
  if (body.userToken) {
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("무료 미리보기 회원 확인 실패(익명으로 진행):", error);
      user = null;
    }
  }
  const userId = user?.userId ?? null;

  /*
    결제 전에 만들지 않기로 한 뒤로, 이 자리가 로그인 관문이다.

    전에는 익명으로 미리보기를 만들고 결제 앞에서 로그인을 받았다. 그때는 관문을
    뒤로 미룰수록 폼을 끝내는 사람이 늘었기 때문이다. 지금은 폼 뒤에 오는 것이
    무료 글이 아니라 주문이라, 주인 없는 주문을 만들 수가 없다.
  */
  if (PAY_BEFORE_GENERATE && !userId) {
    return NextResponse.json(
      { error: "사주를 세우려면 먼저 로그인해주세요.", needSignup: true },
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

  // 두 사람을 보는 상품에 상대가 없으면 만들지 않는다.
  //
  // 화면에서도 막지만 여기서 한 번 더 본다 — 화면은 사람이 고치거나 건너뛸 수
  // 있고, 그렇게 들어온 요청은 두 명식을 잇는 규칙이 통째로 죽은 채 12절을 쓴다.
  // 상대 이야기가 본인 이야기의 되풀이가 되고, 그 값을 치른 사람은 두 사람을
  // 보러 온 사람이다.
  if (PRODUCT_MAP[body.category]?.needsPartner && !body.partner) {
    return NextResponse.json(
      { error: "이 리포트는 두 사람의 사주를 함께 봐요. 그 사람의 생년월일도 입력해주세요." },
      { status: 400 }
    );
  }

  const bundle = body.bundleId ? resolveBundle(body.category, body.bundleId) : null;
  if (body.bundleId && !bundle) {
    return NextResponse.json({ error: "유효하지 않은 세트예요." }, { status: 400 });
  }
  // 세트와 광고 오퍼는 같이 못 쓴다. 세트가 이긴다 — 세트 값이 더 크다.
  let offer = body.offerId && !bundle ? resolveAdOffer(body.category, body.offerId) : null;
  if (body.offerId && !offer) {
    return NextResponse.json({ error: "유효하지 않은 광고 오퍼입니다." }, { status: 400 });
  }

  // 광고 오퍼는 첫 구매 전까지만. 오퍼 id 는 광고 URL 에 실리는 공개값이라,
  // 이 검사가 없으면 링크를 아는 누구든 언제까지고 1,900원에 산다.
  // 확인이 안 되면 오퍼를 살려 둔다 — DB 가 잠깐 흔들렸다고 광고에서 온
  // 사람의 전환을 잃는 쪽이 1,900원 몇 번 더 파는 것보다 비싸다.
  // 익명이면 여기서는 알 수 없다 - 결제 앞(unlock/checkout)에서 같은 검사를
  // 한 번 더 한다.
  if (offer && userId) {
    try {
      if (await hasPaidReadingOrder(userId)) offer = null;
    } catch (error) {
      console.error("오퍼 자격 확인 실패:", error);
    }
  }

  if (userId) {
    try {
      const birthdate = [
        String(body.me.year).padStart(4, "0"),
        String(body.me.month).padStart(2, "0"),
        String(body.me.day).padStart(2, "0"),
      ].join("-");
      await saveUserSajuProfile(userId, {
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
  }

  const myChart = computeSaju(body.me);
  const partnerChart = body.partner ? computeSaju(body.partner) : null;
  const label = PRODUCT_MAP[body.category]?.promptLabel ?? "연애운";
  const price = bundle ? bundle.price : priceFor(body.category ?? "", offer?.id);
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

  // 계산값에서 켜지는 검수 규칙. 이 목록이 리포트가 말해도 되는 것의 경계가 된다.
  // 목차가 15절인데 규칙을 12개만 켜면 세 절은 남의 근거로 쓴다.
  // 절마다 딛을 것이 하나는 있어야 같은 판단이 형태만 바꿔 반복되지 않는다.
  const matchedRules = matchRules(
    myFacts,
    partnerFacts,
    body.category,
    Math.max(12, product?.toc.length ?? 12)
  );
  const forbiddenClaims = forbiddenFromRules(matchedRules);

  const fullOutline = product?.toc ?? ["나의 핵심 결", "관계의 결", "지금의 흐름"];
  // 목차가 파는 것과 계산이 감당하는 것을 맞춘다. 앞날이 없는데 "앞으로 6개월"을
  // 팔면 그 절은 지난달 이야기로 끝난다 — 모델의 문제가 아니라 입력의 문제다.
  const scoped = scopeOutline({
    product: body.category,
    outline: fullOutline,
    facts: myFacts,
    matchedRules,
    label,
  });
  const outline = scoped.outline;
  // 이름이 "3년 흐름"을 말하면 목차를 좁혀도 모델은 이름 쪽을 믿는다. 함께 좁힌다.
  const scopedLabel = scoped.label ?? label;
  if (scoped.notes.length > 0) {
    console.warn("리딩 범위 축소:", scoped.notes.join(" / "));
  }
  // 목차가 길수록 출력이 길어진다. 8000으로 고정하면 12~15장짜리 리포트가 중간에 잘린다.
  // 한글은 토큰을 많이 먹으므로 항목당 넉넉히 잡고 모델 상한(16k)에서 멈춘다.
  // 자유 입력이라 길이를 잘라 둔다. 프롬프트로 들어가는 값이므로 긴 문장을
  // 그대로 실으면 지시문을 밀어내는 데 쓰일 수 있다.
  const occupation = (body.occupation ?? "").trim().slice(0, 30);

  // 지수는 명식에서 뽑는다 — 인자와 근거가 함께 나온다.
  // 계산은 여기, 이 한 번뿐이다. 대운·세운을 보는 인자가 섞여 있어 내년에 다시
  // 돌리면 다른 숫자가 나오므로, 결과를 통째로 봉인해 리딩 레코드에 저장한다.
  // 해금·재조회는 전부 저장된 봉인을 읽는다(= 이미 판 리딩의 숫자는 그대로다).
  //
  // 생성보다 먼저 낸다. 목차가 지수를 파는 상품(속궁합)은 그 절을 쓰는 동안
  // 숫자를 봐야 하는데, 예전에는 리포트를 다 만든 뒤에 계산해서 모델이 못 봤다.
  // 그래서 화면의 숫자와 본문의 등급이 따로 정해졌다.
  const scoreResult = computeSajuScore(body.category, myFacts, partnerFacts);
  const score = scoreResult.value;
  const scoreBand = product?.meterLabels?.[scoreResult.bandIndex] ?? null;
  const scoreLabel = product?.scoreLabel ?? null;

  const readingInput = {
    facts: myFacts,
    partnerFacts,
    matchedRules,
    productLabel: scopedLabel,
    // 이 리포트가 답할 물음을 고르는 열쇠(reading-axis.ts). 라벨과 따로 넘긴다.
    productId: body.category,
    // 축이 usesScore 를 켠 상품에서만 프롬프트로 나간다. 화면에 찍히는 그 숫자다.
    score: {
      value: score,
      label: scoreLabel,
      band: scoreBand,
      factors: scoreResult.factors.map((f) => ({ label: f.label, delta: f.delta, basis: f.basis })),
    },
    outline,
    // 결제 전에 공개되는 절. 머리와 이 절이 PREVIEW CONTRACT 를 따른다.
    freeItems: outline.slice(0, previewSections()),
    focus: partnerFacts ? "relationship" : "self",
    currentScene: body.question ?? "",
    occupation: occupation || undefined,
    characterId: null,
    characterName: null,
    now,
  };

  // 리딩 id 를 생성보다 먼저 뽑는다.
  //
  // 예전에는 저장 직전에 만들었다. 그러면 모델을 부르는 시점에 id 가 없어서
  // 사용량이 reading_id 없이 남았고, 원가를 리딩별로 붙일 수 없었다 — 시각으로
  // 눈대중 대조하는 수밖에 없었다. UUID 는 저장과 무관하게 미리 정할 수 있다.
  const id = randomUUID();

  // 데모 분기가 생기면서 흐름이 갈라져, 타입 검사가 대입을 증명하지 못한다.
  // 빈 값으로 시작하고 아래 갈래가 반드시 채운다.
  let teaser = "";
  let full = "";
  let report: StructuredReport | null = null;
  let providerName = "demo";
  let generationModel = "";
  // 출고 검사 결과 — 고치지 못한 위반은 blob에 남겨 나중에 되짚을 수 있게 한다
  let guardViolations: GuardViolation[] = [];
  // 생성기가 붙어 있는데도 리포트를 못 만든 경우. 데모 글로 때우면 안 되는 상황이다.
  let generationFailed = false;

  // 데모 모드 — 모델을 부르지 않고 미리 만들어 둔 리포트를 쓴다.
  //
  // 무료 티어는 하루 스무 요청이고 리포트 한 편이 아홉 요청쯤 든다. 하루 두 편으로는
  // 유저 테스트가 안 되는데, 테스트하려는 것 대부분은 글이 아니라 흐름이다.
  // 명식·지수는 그대로 계산한다 — 계산은 공짜이고, 테스터가 자기 사주 네 글자를
  // 제대로 봐야 화면이 자기 것으로 읽힌다. 글이 남의 것이라는 사실은 숨기지 않는다.
  const demo = hasDemoReport(body.category) ? demoReport(body.category) : null;

  // 결제 전에는 글을 만들지 않는다 (reading-gate.ts). 데모보다 앞에 둔다 —
  // 데모 글도 값은 안 들지만, 안 산 사람에게 보여 줄 글 자체가 없어야 한다.
  const deferGeneration = PAY_BEFORE_GENERATE;

  try {
    if (deferGeneration) {
      // 글은 결제가 확인된 뒤 /api/unlock 이 만든다. 여기서는 아무것도 안 쓴다 —
      // teaser 도 full 도 빈 채로 저장되고, 아래에서 재개 정보만 남긴다.
      providerName = effectiveProvider() || "demo";
      throw new SkipGeneration();
    }
    if (demo) {
      report = demo;
      providerName = "demo-fixture";
      ({ teaser, full } = reportToText(report));
      throw new SkipGeneration();
    }

    // 리포트는 머리 하나 + 본문 묶음 여럿을 동시에 받아 합친다(reading-compose.ts).
    // 한 번에 다 시키면 목차 10개짜리가 gpt-5.6에서 128초 걸린다 — 토큰이 순서대로
    // 나오기 때문이고, 그건 요청을 나눠 동시에 던지는 것 말고는 줄일 방법이 없다.
    const composed = await composeReport(
      readingInput,
      // thinking을 끄는 이유는 OpenAI에서 reasoning_effort를 낮게 두는 이유와 같다.
      // 명리 계산은 이미 끝났고 여기서 하는 일은 문장 쓰기다. 게다가 Gemini는 생각
      // 토큰도 maxOutputTokens에서 빼가므로, 켜두면 JSON이 중간에 잘려 조각이 날아간다.
      (system, user, budget, callOptions) =>
        chatComplete(system, [{ role: "user", content: user }], budget, {
          thinking: false,
          json: true,
          ...callOptions,
        }),
      // 결제 전에는 미리보기가 보여주는 절까지만 만든다. 나머지는 결제가 확인된 뒤
      // /api/unlock이 이어 만든다(reading-finish.ts). 결제하지 않는 사람의 유료
      // 본문을 만드느라 돈을 태우지 않기 위해서다.
      { batchLimit: previewBatchCount(outline) }
    );

    // 만들어졌든 못 만들었든 값은 나갔다. 실패한 호출을 빼고 세면 청구서와 안 맞는다.
    void recordAiUsage({
      readingId: id,
      stage: "free_preview",
      category: body.category,
      provider: composed.provider,
      model: composed.model,
      calls: composed.requestCount,
      usage: composed.usage,
    });

    if (!composed.report) {
      // 키가 아예 없으면 데모가 정상(로컬 개발), 키가 있는데 못 만들었으면 장애다.
      if (isAiConfigured()) generationFailed = true;
      ({ teaser, full } = mockReading(body.category));
    } else {
      report = composed.report;
      providerName = composed.provider || "demo";
      generationModel = composed.model;
      if (composed.failedParts.length > 0) {
        console.error("리포트 조각이 비어 있음:", composed.failedParts.join(", "));
      }

      // 스키마는 맞아도 내용이 선을 넘을 수 있다. 한 번 훑고 결과를 남긴다.
      // 이 시점에는 미리보기 몫만 있으므로, 목차 전체가 아니라 만든 절 수로 본다.
      // 나머지 절은 결제 후 완성될 때 다시 검사한다(reading-finish.ts).
      const guard = checkReport(report, {
        expectedSections: report.sections.length,
        forbiddenClaims,
        // 명식을 함께 넘긴다. 이것이 없으면 가드는 리포트만 보고 판정하므로
        // "명식에 없는 글자를 이름으로 부르는" 문제를 원리적으로 못 잡는다.
        facts: myFacts,
        partnerFacts,
        matchedRules,
        productDomain: body.category,
        scoreValue: score,
      });
      guardViolations = guard.violations;
      if (guard.mustRetry) {
        const blocking = guard.violations.filter((v) => v.blocking);
        console.warn(
          "리포트 출고 검사 위반:",
          blocking.map((v) => `${v.where} ${v.detail}`).join(" / ")
        );

        /*
          걸린 절만 다시 받는다.

          여기까지 오는 위반은 표현 문제가 아니다 — 규칙에 없는 상대 성향을
          단정했거나 계산에 없는 값을 근거로 적은 것이고, 이 저장소가 "그러지
          않는다" 고 못 박아 둔 것들이다. 예전에는 경고만 찍고 그대로 내보냈다.
          그러면 가드는 무엇이 잘못됐는지 알면서 그 글을 파는 셈이 된다.

          리포트 전체가 아니라 걸린 절만 다시 받으므로 값이 절당 한 조각치만
          는다. 한 번만 한다 — 두 번째에도 같은 자리가 걸리면 그건 모델이
          흔들린 것이 아니라 이 명식에 그 절을 쓸 근거가 없다는 뜻이다.
        */
        const flagged = flaggedSections(
          guard.violations,
          report.sections.map((section) => section.title)
        );
        if (flagged.length > 0 && isAiConfigured()) {
          const redone = await rewriteFlagged(readingInput, (system, user, budget, callOptions) =>
            chatComplete(system, [{ role: "user", content: user }], budget, {
              thinking: false,
              json: true,
              ...callOptions,
            })
          , flagged);
          // 다시 쓴 절도 값이 든다. 무료 경로의 이 몫이 그동안 어디에도 안 남아,
          // 청구서가 저장소 합계보다 큰 이유 중 하나였다(유료 쪽은 이미 센다 —
          // reading-finish.ts 의 rewrite 기록과 같은 뜻이다).
          void recordAiUsage({
            readingId: id,
            stage: "rewrite",
            category: body.category,
            provider: providerName,
            model: generationModel,
            calls: redone.requestCount,
            usage: redone.usage,
          });

          for (const section of redone.sections) {
            const at = report.sections.findIndex((item) => item.title === section.title);
            if (at >= 0) report.sections[at] = section;
          }
          if (redone.sections.length > 0) {
            const recheck = checkReport(report, {
              expectedSections: report.sections.length,
              forbiddenClaims,
              facts: myFacts,
              partnerFacts,
              matchedRules,
              productDomain: body.category,
              scoreValue: score,
            });
            guardViolations = recheck.violations;
            const left = recheck.violations.filter((v) => v.blocking);
            console.warn(
              left.length === 0
                ? `다시 쓴 절 ${redone.sections.length}개로 막는 위반이 사라졌습니다.`
                : `다시 썼는데도 남은 위반: ${left.map((v) => `${v.where} ${v.detail}`).join(" / ")}`
            );
          }
        }

        // 미리보기에 필요한 절도 못 만들었다면 팔 수 없다. 표현 문제는 기록만 남기고 내보낸다.
        if (report.sections.length < Math.min(previewSections(), outline.length) && isAiConfigured())
          generationFailed = true;
      }
      ({ teaser, full } = reportToText(report));
    }
  } catch (e) {
    // 데모는 오류가 아니다. 생성 블록을 건너뛰려고 던진 신호일 뿐이라 조용히 지나간다.
    if (!(e instanceof SkipGeneration)) {
      console.error("AI 호출 실패:", e);
      generationFailed = true;
      ({ teaser, full } = mockReading(body.category));
    }
  }

  // 키가 없는 로컬 환경에서는 데모 리딩이 정상이다. 그러나 키가 붙어 있는데 실패한 것은
  // 장애이고, 이때 데모 글을 저장하면 "[데모 모드]"로 시작하는 글이 결제 화면까지 간다.
  // 크레딧 소진·정전·모델 오류가 조용히 매출로 이어지지 않도록 여기서 끊는다.
  if (generationFailed && isAiConfigured()) {
    return NextResponse.json(
      { error: "지금은 사주를 풀지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }

  // 풀 리딩은 서버에만 저장 — 결제 확인(/api/unlock) 후에만 내려간다.
  const chart = {
    me: chartSummary(myChart),
    partner: partnerChart ? chartSummary(partnerChart) : null,
  };
  const createdAt = new Date().toISOString();
  const scoreSeal = sealScore(scoreResult, { band: scoreBand, label: scoreLabel, issuedAt: createdAt });
  // 운영에서는 반드시 Supabase에 저장하고, 로컬 무설정 환경만 파일 저장소를 쓴다.
  try {
    await saveReading({
      id,
      // 무료 리딩부터 로그인한 사용자에게 귀속한다.
      userId: userId ?? undefined,
      createdAt,
      category: body.category,
      teaser,
      full,
      chart,
      provider: providerName,
      price,
      score,
      scoreLabel,
      scoreSeal,
      unlocked: false,
    });

    // 삽화를 여기서 정해 둔다. 만들지 않고 고른다 - 감정 태그 x 컷 위치 x 일간 오행으로
    // 미리 그려 둔 것에서 꺼낸다. 그림 생성 API 는 이 경로에서 한 번도 부르지 않는다.
    //
    // 발급 시점에 정해 두면 화면은 열리자마자 그림을 갖고 시작한다. 예전에는 열고 나서
    // 만들기 시작해 분 단위로 빈자리를 띄웠고, 7분이 지나면 포기하는 안전망까지 있었다.
    try {
      const illustrated = pickIllustrated(
        (report?.sections ?? []).map((section, index) => ({ chapter: index + 1, section }))
      );
      await saveImageState(
        id,
        planImagesFor({
          chapterNumbers: illustrated.map((item) => item.chapter),
          chapterEmotionTags: illustrated.map((item) => item.section.emotionTags ?? []),
          chart: chart.me,
          label: PRODUCT_MAP[body.category]?.shortLabel ?? PRODUCT_MAP[body.category]?.title,
        })
      );
    } catch (assetError) {
      // 그림이 없어도 리딩은 나간다. 여기서 막으면 글까지 못 준다.
      console.error("삽화 계획 저장 실패:", assetError);
    }
  } catch (e) {
    console.error("리딩 저장 실패:", e);
    if (isDatabaseConfigured() || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "리딩을 안전하게 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }
  }

  // 무료 공개분: 확정된 첫 절 일부를 읽히고, 나머지는 제목만 목차에 남긴다.
  // 잠긴 제목은 상품 목차에서 뽑는다 — 그 절은 아직 만들지도 않았고, 어차피 모델이
  // 목차 문구를 그대로 옮겨 적게 돼 있어 결과가 같다.
  const preview = deferGeneration
    ? { sections: [], lockedTitles: outline, openLoop: null }
    : report
    ? {
        sections: report.sections.slice(0, previewSections()).map((section, index) => ({
          title: section.title,
          excerpt: section.summary.slice(0, 360),
          // 무료에서 만든 첫 절은 결제 뒤에도 그대로 남는다. 화면에는 답과 첫 문단만
          // 공개하고, 구조화 원문은 서버의 재개 정보에 보관한다.
          ...(index === 0 && section.paragraphs[0]
            ? { paragraphs: [section.verdict ?? section.summary, section.paragraphs[0]].filter(Boolean) }
            : {}),
        })),
        lockedTitles: outline.slice(previewSections()),
        // 공개분이 남긴 물음. "이어서 보기" 창이 이 문장으로 연다.
        openLoop: report.meta.openLoop ?? null,
      }
    : { ...previewOf(full, product?.toc ?? ["명식 분석", "기질 분석", "시기 판단", "행동 가이드"]), openLoop: null };

  // 나머지 본문을 결제 후에 이어 만들기 위한 정보. 클라이언트 blob에만 두면
  // 계좌이체처럼 며칠 뒤에 승인되는 경우 기기를 바꾼 사용자에게 못 준다.
  //
  // 결제 전에 만들지 않는 흐름(deferGeneration)에서는 report 가 없다. 그래도 —
  // 아니, 그래서 더더욱 — 재개 정보를 남겨야 한다. 이게 없으면 결제 뒤에
  // finishReading 이 "만들 것이 없다"고 판단해 빈 리딩을 열어 준다.
  if (deferGeneration || (report && report.sections.length < outline.length)) {
    try {
      const provider = effectiveProvider();
      await saveResume(id, {
        category: body.category,
        facts: myFacts,
        partnerFacts,
        ruleIds: matchedRules.map((rule) => rule.id),
        productLabel: scopedLabel,
        currentScene: body.question ?? "",
        occupation: occupation || undefined,
        // 발급 시각 — 나머지를 만들 때 대운·세운을 같은 기준으로 잡기 위해.
        // 리딩 계산에 쓴 now를 그대로 쓴다(다른 변수에 기대지 않는다).
        issuedAt: now.toISOString(),
        // 결제 전 예약이면 0 절. finishReading 이 처음부터 만든다.
        doneSections: report?.sections.length ?? 0,
        outline,
        partialReport: report,
        ...(report ? { continuity: continuityFromReport(report) } : {}),
        ...(provider ? { provider } : {}),
        ...(generationModel ? { model: generationModel } : {}),
        promptVersion: READING_PROMPT_VERSION,
      });
    } catch (e) {
      // 여기서 실패하면 결제 후에 나머지를 만들 방법이 없다. 팔지 않는다.
      console.error("재개 정보 저장 실패:", e);
      return NextResponse.json(
        { error: "리딩을 안전하게 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }
  }
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
    openLoop: preview.openLoop,
    // 지수는 결제 전에도 공개한다 (운영자 결정, 2026-08-22). "상위 N%" 가
    // 표지의 미끼가 되고, 그 숫자가 왜 나왔는지(scoreFactors)는 여전히 해금
    // 뒤에만 온다 — 숫자는 무료, 근거는 유료다.
    scoreLabel,
    score,
    scoreBand,
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
      // 봉인된 지수 한 덩어리. DB가 정본이고, 이건 예전 클라이언트와의 호환용 사본이다.
      scoreSeal,
      score,
      scoreLabel,
      scoreBand,
      scoreFactors: scoreResult.factors,
      // 구조화 리포트를 통째로 봉인한다. 텍스트로 눌러 담으면 facts_used와
      // watch_out이 사라져, 나중에 "이 문장이 어디서 나왔나"를 되짚을 수 없다.
      report,
      // 고치지 못하고 내보낸 위반 — 사용자에게는 안 보이지만 감사할 수 있어야 한다
      guardViolations,
      // 어떤 규칙으로 읽었는지. 나중에 규칙을 고칠 때 영향 범위를 찾을 수 있다.
      ruleIds: matchedRules.map((rule) => rule.id),
    }),
    demo: providerName === "demo",
    provider: providerName,
  });
}
