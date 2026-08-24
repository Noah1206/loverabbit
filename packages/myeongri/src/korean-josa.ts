// 조사 — 앞 글자에 받침이 있는지로 갈린다.
//
// 관리 화면과 감사 리포트에 "억부과 조후이 서로" 같은 문장이 그대로 찍힌다.
// 운영자가 읽는 글이라 상품 문장만큼 다듬을 필요는 없지만, 조사가 틀리면
// 그 화면 전체가 대충 만든 것처럼 읽힌다. 다섯 줄이면 안 그래도 된다.

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 마지막 글자에 받침이 있는가 */
export function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return false;
  return (code - HANGUL_START) % 28 !== 0;
}

/** 은/는, 이/가, 을/를, 와/과 — 앞말에 맞춰 고른다 */
export function josa(word: string, pair: "은는" | "이가" | "을를" | "와과"): string {
  const final = hasFinalConsonant(word);
  switch (pair) {
    case "은는":
      return final ? "은" : "는";
    case "이가":
      return final ? "이" : "가";
    case "을를":
      return final ? "을" : "를";
    case "와과":
      return final ? "과" : "와";
  }
}

/** "억부" + 와과 -> "억부와" */
export function withJosa(word: string, pair: "은는" | "이가" | "을를" | "와과"): string {
  return `${word}${josa(word, pair)}`;
}
