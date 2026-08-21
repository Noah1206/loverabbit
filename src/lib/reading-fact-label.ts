// 근거 칩을 사람이 읽는 말로.
//
// 절 아래 붙는 칩은 "이 문장이 어디서 나왔나" 를 되짚기 위한 것이다. 그런데
// 지금까지 `strength.label=신약` 처럼 **내부 경로를 그대로** 내보내고 있었다.
// 본문에서는 구조 용어를 다 걷어내 놓고(reading-prompt.ts) 정작 그 아래 칩에
// 원본 경로가 남아 있었으니 앞뒤가 맞지 않았다.
//
// 여기서 두 가지를 한다.
//   1. 경로 -> 무엇을 가리키는 값인지 한국어 이름
//   2. 값 안의 자리 코드(일지·월지) -> 그 자리가 뜻하는 것
//
// 값 자체(신약·상관·축미충)는 **지운다고 좋아지지 않는다.** 그 사람 명식에만 있는
// 이름이라 지우면 근거가 근거가 아니게 된다. 대신 짧은 풀이를 함께 붙인다.

/** 경로 -> 화면에 쓰는 이름 */
const PATH_LABEL: [RegExp, string][] = [
  [/^strength\.label$/, "자기 힘"],
  [/^strength\.score$/, "자기 힘 점수"],
  [/^dominantTenGods$/, "두드러진 기운"],
  [/^tenGods\.연간$/, "태어난 해 (윗글자)"],
  [/^tenGods\.연지$/, "뿌리 자리"],
  [/^tenGods\.월간$/, "사회 자리 (윗글자)"],
  [/^tenGods\.월지$/, "사회 자리"],
  [/^tenGods\.일지$/, "배우자 자리"],
  [/^tenGods\.시간$/, "말년 자리 (윗글자)"],
  [/^tenGods\.시지$/, "말년 자리"],
  [/^notableRelations$/, "부딪히고 묶이는 자리"],
  [/^shinsal$/, "신살"],
  [/^xing$/, "타고난 형(刑)"],
  [/^xingLuck$/, "지금 운에서 들어온 형(刑)"],
  [/^missingElements$/, "없는 기운"],
  [/^elementBalance$/, "기운의 균형"],
  [/^fourPillars/, "사주"],
  [/^luckContext\.majorLuck\.currentTenGod$/, "지금 몇 해 흐름"],
  [/^luckContext\.majorLuck\.currentPillar$/, "지금 몇 해"],
  [/^luckContext\.majorLuck\.currentRange$/, "그 흐름이 걸린 나이"],
  [/^luckContext\.majorLuck/, "지금 몇 해 흐름"],
  [/^luckContext\.yearly\.tenGod$/, "올해 흐름"],
  [/^luckContext\.yearly/, "올해"],
  [/^luckContext\.monthly\.tenGod$/, "이달 흐름"],
  [/^luckContext\.monthly/, "이달"],
  [/^calculationNotes|^limits$/, "계산 한계"],
];

/** 값 안에 섞여 나오는 자리 코드 */
const POSITION_LABEL: Record<string, string> = {
  연간: "태어난 해",
  연지: "뿌리 자리",
  월간: "사회 자리",
  월지: "사회 자리",
  일간: "당신",
  일지: "배우자 자리",
  시간: "말년 자리",
  시지: "말년 자리",
  대운: "지금 몇 해",
  세운: "올해",
  월운: "이달",
};

/**
 * 짧은 풀이. 없으면 안 붙인다 — 모르는 말에 아무 설명이나 붙이는 것보다
 * 이름만 두는 편이 낫다.
 */
const VALUE_GLOSS: Record<string, string> = {
  신강: "센 편",
  신약: "여린 편",
  중화: "치우치지 않음",
  비견: "나와 같은 힘",
  겁재: "나눠야 하는 힘",
  식신: "편하게 나오는 표현",
  상관: "틀을 밀어내는 표현",
  정재: "꾸준히 쌓는 힘",
  편재: "크게 움직이는 힘",
  정관: "지키는 규칙",
  편관: "밀어붙이는 압력",
  정인: "받쳐주는 힘",
  편인: "혼자 정리하는 힘",
  도화: "끌어당기는 기운",
  홍염: "은근한 끌림",
  역마: "움직임·이동",
  화개: "혼자 있는 시간",
  양인: "날 선 힘",
  원진: "이유 없이 걸리는 것",
};

export interface FactChip {
  /** 무엇을 가리키는 값인가 */
  label: string;
  /** 그 값 */
  value: string;
  /** 짧은 풀이. 붙일 게 없으면 비어 있다 */
  gloss: string;
  /** 상대 명식의 값인가 */
  partner: boolean;
}

function labelOf(path: string): string {
  for (const [pattern, label] of PATH_LABEL) if (pattern.test(path)) return label;
  // 모르는 경로는 마지막 마디만 보여준다. 점 찍힌 원본을 그대로 내보내지는 않는다.
  return path.split(".").pop() ?? path;
}

/** 자리 코드 앞뒤에 올 수 있는 구분 문자. 낱말 안에 든 글자는 건드리지 않기 위한 울타리다. */
const BOUNDARY = "[,;=·\\s]";

function humanizeValue(value: string): string {
  // 형처럼 "이름=자리,자리" 꼴로 오는 값이 있다. 등호가 두 번 보이면 읽는 사람이
  // 내부 경로라고 오해하므로 줄표로 바꾼다.
  let out = value.replace(/=/g, " — ").replace(/;/g, " / ");
  for (const [code, label] of Object.entries(POSITION_LABEL)) {
    out = out.replace(new RegExp(`(^|${BOUNDARY})${code}(?=$|${BOUNDARY})`, "g"), `$1${label}`);
  }
  return out;
}

function glossOf(value: string): string {
  const found = Object.keys(VALUE_GLOSS).filter((term) => value.includes(term));
  if (found.length === 0) return "";
  // 여러 개가 걸리면 앞의 둘까지만. 칩 한 줄이 문단이 되면 안 읽힌다.
  return found.slice(0, 2).map((term) => VALUE_GLOSS[term]).join(" · ");
}

/**
 * "상대.strength.label=신약" -> { label: "그 사람의 자기 힘", value: "신약", gloss: "여린 편" }
 *
 * 모양이 예상과 달라도 절대 버리지 않는다. 근거가 사라지는 것이 최악이다.
 */
export function toFactChip(raw: string): FactChip {
  const trimmed = raw.trim();
  const partner = trimmed.startsWith("상대.");
  const body = partner ? trimmed.slice("상대.".length) : trimmed;

  const at = body.indexOf("=");
  if (at < 0) {
    // 값 없이 경로만 온 경우 — 이름만 보여준다
    return { label: labelOf(body), value: "", gloss: "", partner };
  }
  const path = body.slice(0, at);
  const value = humanizeValue(body.slice(at + 1).trim());
  const label = labelOf(path);
  return {
    label: partner ? `그 사람의 ${label}` : label,
    value,
    gloss: glossOf(value),
    partner,
  };
}
