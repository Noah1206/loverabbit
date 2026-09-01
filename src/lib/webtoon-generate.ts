import "server-only";

// 웹툰 사주 문장 만들기 — 승인된 사실 안에서만 쓴다.
//
// 리딩 본문과 같은 재료(slimFacts)를 같은 규칙으로 받는다. 다른 것은 모양뿐이다:
// 리포트는 절과 문단으로 읽히고, 웹툰은 말풍선과 캡션으로 읽힌다.
//
// **명식은 StoredReading 에서 복원할 수 없다.** chart.me 는 "연주 갑자 (띠: 쥐)…"
// 같은 사람이 읽는 한 줄이라 대운·세운을 세울 생년월일이 없다. 그래서 회원
// 프로필(lr_user_profiles)의 생년월일시로 buildSajuFacts 를 다시 돌린다. 프로필이
// 없으면 명식 문장은 만들지 않고 고정 카피로 간다 — 없는 명식을 지어내지 않는다.
//
// 절대 규칙(CLAUDE.md)이 여기서도 그대로 선다:
//   · approvedFacts 밖의 명리 주장을 만들지 않는다
//   · 점수·날짜·간지·띠·일간을 지어내거나 바꾸지 않는다
//   · 가드를 우회하지 않는다 — 걸리면 고정 카피로 내려간다

import { chatComplete } from "@/lib/ai";
import { computeSaju, type SajuChart } from "@/lib/saju";
import { getUserSajuProfile } from "@/lib/database";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import { slimFacts } from "@/lib/reading-prompt";
import { applyDraft, guardDraft, parseDraft, type WebtoonDraft } from "@/lib/webtoon-draft";
import {
  buildWebtoonContent,
  WEBTOON_FORTUNE_CONFIG,
  type FortuneType,
  type WebtoonContent,
} from "@/lib/webtoon-saju";

/** 이 프롬프트가 바뀌면 올린다. 캐시 열쇠에 들어가 옛 문장과 섞이지 않게 한다. */
export const WEBTOON_PROMPT_VERSION = "webtoon-v1";

const SYSTEM = `# 역할

너는 러브레빗의 웹툰 사주 작가다. 사주 계산 결과를 웹툰 한 편의 말과 글로 옮긴다.

**화면에 나오는 것은 토끼 하나뿐이다.** 사용자는 그림에 없고 이름으로만 불린다.
토끼가 독자에게 직접 말을 건다 — 사주를 겪는 당사자가 아니라, 옆에서 장면을
짚어 주고 어려운 말을 쉬운 말로 풀어 주는 친구다.

한 편은 8컷이고 그중 5컷에서 토끼가 말한다. 나머지 3컷은 배경·소품이라
말풍선 대신 캡션 한 줄이 붙는다.

# 절대 규칙

1. **주어진 saju_facts 안에서만 말한다.** 거기 없는 명리 주장을 만들지 않는다.
2. **숫자·간지·띠·일간을 지어내거나 바꾸지 않는다.** 인용할 것은 그대로 인용한다.
3. **구조 용어를 본문에 쓰지 않는다.** 십성·신강신약·용신·격국·지장간 같은 말을
   독자에게 그대로 내보내지 않는다. 뜻을 쉬운 말로 옮겨서 쓴다.
   (예: "식상이 강하다" → "표현이 먼저 나가는 결이에요")
4. **단정하지 않는다.** "반드시·무조건·틀림없이·100%·운명이다"를 쓰지 않고,
   헤어진다·결혼한다 같은 결과를 확정해서 말하지 않는다.
5. **의료·법률·금융 지시를 하지 않는다.**
6. 이별운은 이별을 예언하는 자리가 아니다. 지금의 거리와 회복의 순서만 말한다.

# 말투

해요체. 토끼는 사용자를 이름으로 부르고 반말 섞인 다정한 말을 쓴다.
**말풍선은 아주 짧다.** 한 줄에 8~12자, 많아야 두 줄. 타원 안에 들어가야 하므로
길면 넘친다. 캡션도 한 줄이다.
상세 분석 문단은 각각 두세 문장으로 온전한 글이어야 한다.

# 출력

JSON 하나만 낸다. 다른 말은 붙이지 않는다.

{
  "previewText": "토끼가 처음 건네는 말 (2문장, 사용자 이름으로 시작)",
  "previewPoints": ["핵심 한 줄", "핵심 한 줄", "핵심 한 줄"],
  "panelLines": [
    { "rabbit": "01 맞이함 — 인사와 시작 (짧게)" },
    { "rabbit": "03 짚어줌 — 꼭 짚을 것 하나" },
    { "rabbit": "05 걱정함 — 조심할 것 하나" },
    { "rabbit": "07 풀어줌 — 권하는 것 하나" },
    { "rabbit": "08 배웅함 — 다음을 기약" }
  ],
  "captions": ["02 전환 컷 캡션", "04 소품 컷 캡션", "06 경과 컷 캡션"],
  "fullParagraphs": ["상세 분석 문단", "문단", "문단", "문단"],
  "factsUsed": ["인용한 saju_facts 경로", "..."]
}`;

/**
 * 명식으로 웹툰 문장을 쓴다. 실패·가드 위반이면 null — 부르는 쪽은 고정 카피로 간다.
 */
async function draftFor(
  facts: SajuFacts,
  fortuneType: FortuneType,
  nickname: string
): Promise<WebtoonDraft | null> {
  const config = WEBTOON_FORTUNE_CONFIG[fortuneType];
  const user = JSON.stringify({
    saju_facts: slimFacts(facts),
    subject_nickname: nickname,
    fortune: { type: fortuneType, label: config.label, theme: config.theme },
  });

  const result = await chatComplete(SYSTEM, [{ role: "user", content: user }], 2400, {
    thinking: false,
    json: true,
  }).catch((error) => {
    console.error("웹툰 문장 생성 실패:", error);
    return null;
  });
  if (!result?.text) return null;

  const draft = parseDraft(result.text);
  if (!draft) return null;
  // 가드는 여기서만 선다. 통과 못 하면 버린다 — 고쳐 쓰지 않는다.
  return guardDraft(draft) ? draft : null;
}

/**
 * 이 회원의 명식으로 웹툰 한 편을 짓는다.
 *
 * 프로필이 없거나, AI 가 없거나, 가드에 걸리면 고정 카피를 그대로 돌려준다.
 * 화면은 어느 쪽이든 똑같이 그려진다 — 문장만 명식을 반영하느냐 아니냐가 다르다.
 */
/**
 * 이 사람의 명식(만세력 표) — 화면이 그대로 그릴 수 있는 모양으로.
 *
 * 웹툰은 이미 이 명식으로 문장을 쓴다. 그런데 화면에는 그 근거가 보이지
 * 않아서, 읽는 사람은 "내 사주로 쓴 글"인지 알 길이 없었다. 표를 함께 내려
 * 보내 폼에 넣은 값이 실제로 쓰였다는 것을 눈으로 보이게 한다.
 *
 * 생년월일이 없으면 null — 지어내지 않는다.
 */
export async function webtoonChartFor(
  userId: number
): Promise<{ chart: SajuChart; birthLine: string } | null> {
  const profile = await getUserSajuProfile(userId).catch(() => null);
  if (!profile?.birthdate) return null;
  const [year, month, day] = profile.birthdate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const hour = profile.birthTimeUnknown ? null : profile.birthHour;
  try {
    const chart = computeSaju({ year, month, day, hour });
    const time = hour === null ? "시간 모름" : `${String(hour).padStart(2, "0")}시`;
    return { chart, birthLine: `${year}.${month}.${day} · ${time}` };
  } catch (error) {
    console.error("웹툰 명식 표 계산 실패:", error);
    return null;
  }
}

export async function generateWebtoonContent(
  userId: number,
  fortuneType: FortuneType,
  nickname: string
): Promise<{ content: WebtoonContent; personalized: boolean }> {
  const base = buildWebtoonContent(fortuneType, nickname);

  const profile = await getUserSajuProfile(userId).catch(() => null);
  // 생년월일이 없으면 명식이 없다. 지어내지 않는다.
  if (!profile?.birthdate || !profile.gender) return { content: base, personalized: false };

  const [year, month, day] = profile.birthdate.split("-").map(Number);
  if (!year || !month || !day) return { content: base, personalized: false };

  let facts: SajuFacts;
  try {
    facts = buildSajuFacts({
      year,
      month,
      day,
      hour: profile.birthTimeUnknown ? null : profile.birthHour,
      gender: profile.gender,
    });
  } catch (error) {
    console.error("웹툰 명식 계산 실패:", error);
    return { content: base, personalized: false };
  }

  const draft = await draftFor(facts, fortuneType, nickname);
  if (!draft) return { content: base, personalized: false };

  return { content: applyDraft(base, draft), personalized: true };
}

/**
 * 만들어 둔 문장을 꺼낸다. 없으면 짓고 담는다.
 *
 * 한 편에 AI 호출 한 번이 드는데 화면은 탭을 옮길 때마다 열린다 — 캐시가 없으면
 * 같은 문장을 매번 다시 산다. 열쇠는 (리딩, 운세, 프롬프트버전) 이라 프롬프트를
 * 고치면 옛 문장이 저절로 비켜난다.
 *
 * DB 가 없으면(로컬) 그냥 짓는다. 담지 못해도 문장은 온전하다 — 캐시는 덤이다.
 */
export async function webtoonContentFor(
  readingId: string,
  userId: number,
  fortuneType: FortuneType,
  nickname: string
): Promise<{ content: WebtoonContent; personalized: boolean }> {
  const db = getSupabaseAdmin();

  if (db) {
    const { data, error } = await db
      .from("lr_webtoon_contents")
      .select("content,personalized")
      .eq("reading_id", readingId)
      .eq("fortune_type", fortuneType)
      .eq("prompt_version", WEBTOON_PROMPT_VERSION)
      .maybeSingle();
    if (error) console.error("웹툰 문장 조회 실패:", error);
    if (data?.content) {
      return { content: data.content as WebtoonContent, personalized: Boolean(data.personalized) };
    }
  }

  const made = await generateWebtoonContent(userId, fortuneType, nickname);

  // 고정 카피는 담지 않는다. 담아 두면 프로필을 나중에 채운 사람이 영영 고정
  // 카피만 보게 된다 — 다음에 열 때 다시 시도하는 편이 낫다.
  if (db && made.personalized) {
    const { error } = await db.from("lr_webtoon_contents").upsert(
      {
        reading_id: readingId,
        fortune_type: fortuneType,
        content: made.content,
        personalized: true,
        prompt_version: WEBTOON_PROMPT_VERSION,
      },
      { onConflict: "reading_id,fortune_type,prompt_version" }
    );
    if (error) console.error("웹툰 문장 저장 실패:", error);
  }

  return made;
}
