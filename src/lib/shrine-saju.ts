import { computeSaju, chartSummary, type SajuChart } from "@/lib/saju";
import type { SajuProfile } from "@/lib/database";

// 신당 대화에 손님의 실제 사주를 얹는다.
//
// 지금까지 도령은 "정확한 건 네 사주를 봐야 안다" 고 말하면서 볼 수가 없었다.
// 손님의 생년월일은 이미 저장돼 있었는데 아무도 읽지 않았기 때문이다.
//
// 여기서 지키는 선이 하나 있다. 도령에게 넘기는 것은 명리 엔진이 계산한 간지
// 그 자체뿐이다. "일간이 갑목이니 성격이 이렇다" 같은 해석은 넘기지 않는다 -
// 그건 규칙 표를 거쳐야 하는 주장이고, 대화 상대인 모델이 지어낼 자리가 아니다.
// 도령은 사실을 손에 쥐고 자기 세계관의 말로 풀 뿐이다.

export function chartFromProfile(profile: SajuProfile): SajuChart | null {
  const match = profile.birthdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  try {
    return computeSaju({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: profile.birthTimeUnknown ? null : profile.birthHour,
    });
  } catch {
    // 계산이 안 되면 사주 없이 대화한다. 대화가 막히는 것보다 낫다.
    return null;
  }
}

/** 사주를 아는 손님 — 확인된 간지만 준다. */
export function knownSajuBlock(chart: SajuChart, gender: "F" | "M" | null): string {
  return [
    "",
    "[손님의 사주 — 확인된 사실]",
    chartSummary(chart),
    gender ? `성별: ${gender === "F" ? "여성" : "남성"}` : "",
    "",
    "[사주를 다루는 법]",
    "- 위 간지는 실제로 계산된 값입니다. 손님에게 이미 알고 있는 것처럼 자연스럽게 씁니다.",
    "- 생년월일을 다시 묻지 마세요. 이미 알고 있습니다.",
    "- 위에 없는 간지·날짜·띠·일간을 지어내지 마세요. 모르는 것은 모른다고 합니다.",
    "- 간지를 그대로 나열하지 말고 당신의 세계관 언어로 풉니다.",
    "  (예: 일간이 화(火)라면 '네 안의 불씨가...' 처럼)",
    "- 점수·순위·확률처럼 숫자로 단정하지 마세요. 그건 리딩이 할 일입니다.",
    "- 깊은 풀이를 원하면 사주 리딩을 권합니다. 여기서는 실마리까지입니다.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 사주를 아직 모르는 손님 — 대화 중에 자연스럽게 받아낸다. */
export const ASK_SAJU_BLOCK = [
  "",
  "[손님의 사주 — 아직 모름]",
  "- 손님의 생년월일을 아직 모릅니다. 아는 척하지 마세요.",
  "- 간지·띠·일간을 절대 지어내지 마세요. 지금은 손님의 말만으로 읽습니다.",
  "- 대화가 한 번 이상 오간 뒤, 흐름이 자연스러운 자리에서 태어난 날을 물어보세요.",
  "  캐릭터의 말투로 묻습니다. (예: '네 기운을 제대로 보려면 태어난 날이 필요해.')",
  "- 한 번 물어서 답이 없으면 더 조르지 마세요. 대화는 그대로 이어갑니다.",
].join("\n");

export function sajuBlockFor(profile: SajuProfile | null): string {
  if (!profile) return ASK_SAJU_BLOCK;
  const chart = chartFromProfile(profile);
  return chart ? knownSajuBlock(chart, profile.gender) : ASK_SAJU_BLOCK;
}
