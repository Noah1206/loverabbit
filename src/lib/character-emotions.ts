// 신당 캐릭터가 지을 수 있는 표정 목록.
//
// 대사마다 도령/신녀의 얼굴이 바뀐다. 어떤 표정인지는 두 경로로 정해진다.
//  1) 모델이 답 끝에 [emotion:shy] 같은 꼬리표를 붙인다 (정확함)
//  2) 꼬리표가 없거나 모르는 값이면 *지문* 에서 낱말로 추측한다 (안전망)
//
// 여기 없는 표정은 존재하지 않는 것으로 친다. 영상 파일 이름도 이 id 를 쓴다.

export const EMOTIONS = [
  "idle",
  "shy",
  "laugh",
  "tease",
  "disgust",
  "sulk",
  "surprise",
  "sad",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const DEFAULT_EMOTION: Emotion = "idle";

export const EMOTION_LABEL: Record<Emotion, string> = {
  idle: "평온",
  shy: "부끄러움",
  laugh: "웃음",
  tease: "유혹",
  disgust: "극혐",
  sulk: "삐짐",
  surprise: "놀람",
  sad: "슬픔",
};

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
}

// 모델이 붙이는 꼬리표. 화면에 보이면 안 되므로 서버에서 떼어낸다.
const TAG = /\[emotion:\s*([a-z_]+)\s*\]/i;

export function extractEmotionTag(text: string): { text: string; emotion: Emotion | null } {
  const match = text.match(TAG);
  if (!match) return { text, emotion: null };
  const value = match[1].toLowerCase();
  return {
    text: text.replace(TAG, "").replace(/\n{3,}/g, "\n\n").trim(),
    emotion: isEmotion(value) ? value : null,
  };
}

// 안전망 — *지문* 안의 낱말로 표정을 추측한다.
//
// 순서가 곧 우선순위다. 한 지문에 "웃으며 눈을 피한다" 처럼 둘이 같이 있으면
// 앞에 있는 규칙이 이긴다. 부끄러움을 웃음보다 앞에 둔 이유가 이것이다 -
// 눈을 피하는 웃음은 웃음이 아니라 부끄러움이다.
// 낱말은 어간까지만 적는다. 한글은 어미가 붙으면서 앞 글자가 통째로 바뀐다 -
// "돌리" 는 "돌린다" 에 걸리지 않는다 (리 + ㄴ = 린). 그래서 "돌" 에서 끊는다.
const HINTS: Array<[Emotion, RegExp]> = [
  ["disgust", /(질색|역겹|눈살|인상을 찌푸|고개를 젓|경멸|혐오|손사래|정색)/],
  ["shy", /(붉어|붉히|발그|얼굴을 붉|볼이|수줍|부끄|눈을 피|시선을 돌|고개를 숙|말을 흐)/],
  ["tease", /(눈웃음|눈꼬리를 접|입꼬리를 올|나른|몸을 기울|가까이|턱을 괴|턱을 괸|손끝으로 훑|유혹|속삭)/],
  ["surprise", /(눈을 크게|멈칫|숨을 삼키|놀란|흠칫|고개를 번쩍|눈이 커)/],
  ["sad", /(눈을 내|가라앉|한숨|씁쓸|쓸쓸|눈시울|목이 메|시선을 떨)/],
  ["sulk", /(입을 삐죽|팔짱|툭|토라|볼을 부풀|외면|시큰둥)/],
  ["laugh", /(웃음을 터|크게 웃|킥킥|풋|어깨를 들썩|박장|소리 내어 웃)/],
];

export function inferEmotion(text: string): Emotion {
  // 지문만 본다. 대사에 "웃겨" 같은 말이 있다고 캐릭터가 웃는 것은 아니다.
  const stage = [...text.matchAll(/\*([^*]+)\*/g)].map((match) => match[1]).join(" ");
  const source = stage || text;
  for (const [emotion, pattern] of HINTS) {
    if (pattern.test(source)) return emotion;
  }
  return DEFAULT_EMOTION;
}

export function resolveEmotion(text: string): { text: string; emotion: Emotion } {
  const { text: clean, emotion } = extractEmotionTag(text);
  return { text: clean, emotion: emotion ?? inferEmotion(clean) };
}
