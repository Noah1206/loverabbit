// 타로 리포트 출고 검사.
//
// 명리 리딩의 가드(reading-guard.ts)를 그대로 쓰되, 명식이 없어 건너뛰는
// 자리를 카드로 메운다.
//
// 재사용하는 것 (facts 를 넘기지 않으면 저절로 그것만 돈다):
//   · 단정 표현 — 반드시·무조건·확정이다·운명이다
//   · 선넘음 — 진단·처방·법률·투자 지시
//   · 금지 문구 — TAROT_FORBIDDEN (타로라는 형식이 넘지 않는 선)
//
// 여기서 새로 보는 것:
//   · 뽑지 않은 카드를 불렀는가  (명리의 GUARD-NAMED-TERM-ABSENT 에 해당)
//   · 뽑힌 무거운 카드가 미끄러지는 낱말로 갔는가 (CARD_LEAKS)
//   · 자리 셋이 다 있고 카드 이름이 뽑은 것과 맞는가
//   · 카드가 나온 이유를 명식으로 설명했는가
//
// 카드의 forbidden(tarot-cards.ts)은 여기서 문자열로 찾지 않는다. 그것은
// 사람이 읽는 설명문("죽음·사망을 뜻한다는 말")이라 본문과 대조가 안 된다 —
// 그쪽은 프롬프트로 모델에게 넘기고, 검사는 CARD_LEAKS 의 낱말로 한다.
//
// 왜 이 셋인가. 타로에서 모델이 미끄러지는 방향이 정확히 이것들이다. 카드를
// 더 부르면 안 뽑은 것을 말하는 것이고, 자리가 어긋나면 과거 자리에 미래를
// 말하게 되며, 인과를 만들면 어느 근거에도 없는 주장이 된다.

import { ABSOLUTE_PATTERNS, OUT_OF_SCOPE } from "@/lib/reading-guard";
import { MAJOR_ARCANA } from "@/lib/tarot-cards";
import { TAROT_FORBIDDEN, type TarotDraw } from "@/lib/tarot-reading";

export interface TarotSection {
  position: string;
  cardName: string;
  read: string;
}

export interface TarotReport {
  cards: TarotSection[];
  closing: string;
  grainUsed?: string[];
}

export interface TarotViolation {
  kind: "단정" | "선넘음" | "카드" | "구조" | "인과";
  where: string;
  detail: string;
  blocking: boolean;
}

export interface TarotGuardResult {
  ok: boolean;
  violations: TarotViolation[];
}

/**
 * 카드마다 실제로 새어 나오는 낱말.
 *
 * tarot-cards.ts 의 forbidden 은 사람이 읽는 설명문이라 검사에 쓸 수 없다.
 * 여기는 그 설명을 **찾을 수 있는 낱말**로 옮긴 것이다. 뽑힌 카드에만 건다.
 */
const CARD_LEAKS: Record<string, [RegExp, string][]> = {
  death: [
    [/(사망|죽는다|죽습니다|돌아가시)/, "죽음"],
    [/(관계가|사이가)\s*끝(난다|납니다|나요)/, "관계 종료 단정"],
  ],
  "the-tower": [
    [/(사고가 난|재난|망해요|망합니다|파산)/, "재난"],
  ],
  "the-devil": [
    [/(중독(이다|입니다|이에요)|정신병|나쁜 사람)/, "진단·낙인"],
  ],
  "the-moon": [
    [/(거짓말을 하고 있|속이고 있)/, "거짓 판정"],
  ],
  "the-empress": [
    [/(임신|출산)(해요|합니다|할 거)/, "임신 예고"],
  ],
};

/** 명식으로 카드를 설명하는 인과 — 어느 근거에도 없다 */
const CAUSAL_PATTERNS: [RegExp, string][] = [
  [/카드가\s*나온\s*(것은|이유)/, "카드가 나온 이유"],
  [/(일간|명식|사주)(이|가|라서|이라서|때문에)\s*[^.]*카드/, "명식이 카드를 부른다는 말"],
  [/그래서\s*이\s*카드/, "그래서 이 카드"],
];

/**
 * 타로 리포트를 내보내기 전에 훑는다.
 *
 * 뽑은 카드(draw)를 함께 받는 이유: 무엇이 허용된 이름인지 그것 말고는 알
 * 길이 없다. 명리 가드가 facts 를 받아 allowedNamedTerms 를 만드는 것과 같다.
 */
export function checkTarot(report: TarotReport, draw: TarotDraw): TarotGuardResult {
  const out: TarotViolation[] = [];
  const drawnNames = draw.cards.map((c) => c.card.name);
  const drawnSet = new Set(drawnNames);

  const allText = [
    ...report.cards.map((c) => `${c.cardName} ${c.read}`),
    report.closing,
  ].join("\n");

  // ── 재사용: 단정 ──
  for (const [pattern, label] of ABSOLUTE_PATTERNS) {
    if (pattern.test(allText)) {
      out.push({ kind: "단정", where: "report", detail: `단정 표현 "${label}"`, blocking: true });
    }
  }

  // ── 재사용: 선넘음 ──
  for (const [pattern, label] of OUT_OF_SCOPE) {
    if (pattern.test(allText)) {
      out.push({ kind: "선넘음", where: "report", detail: `범위 밖 "${label}"`, blocking: true });
    }
  }

  // ── 재사용: 타로 공통 금지 문구 ──
  //
  // 카드의 forbidden 은 **사람이 읽는 설명문**이라("죽음·사망을 뜻한다는 말")
  // 본문에서 그 문자열을 찾는 방식이 안 통한다. 그건 모델에게 넘겨 프롬프트로
  // 막고, 여기서는 실제로 새어 나오는 낱말을 본다 — 아래 CARD_LEAKS.
  for (const phrase of TAROT_FORBIDDEN) {
    if (allText.includes(phrase)) {
      out.push({ kind: "카드", where: "report", detail: `금지된 말 "${phrase}"`, blocking: true });
    }
  }

  // ── 새 검사: 무거운 카드가 미끄러지는 낱말 ──
  //
  // 카드가 뽑혔을 때만 검사한다. 안 뽑힌 카드의 낱말까지 막으면 멀쩡한
  // 문장이 걸린다 — "탑"이 안 뽑혔는데 "무너진다"를 못 쓸 이유가 없다.
  for (const c of draw.cards) {
    const leaks = CARD_LEAKS[c.card.id];
    if (!leaks) continue;
    for (const [pattern, label] of leaks) {
      if (pattern.test(allText)) {
        out.push({
          kind: "카드",
          where: "report",
          detail: `${c.card.name} 카드가 ${label} 쪽으로 갔다`,
          blocking: true,
        });
      }
    }
  }

  // ── 새 검사 1: 뽑지 않은 카드를 불렀는가 ──
  //
  // 스물두 이름을 전부 훑어, 뽑히지 않았는데 본문에 나온 것을 찾는다. 카드
  // 이름이 일상어와 겹치는 것들("힘", "별", "달", "태양", "세계", "정의")이
  // 있어서, 그 여섯은 본문에서 그냥 쓰였을 수 있다 — 그래서 이름 앞뒤에
  // 카드를 가리키는 말이 붙은 경우만 잡는다.
  const AMBIGUOUS = new Set(["힘", "별", "달", "태양", "세계", "정의", "죽음"]);
  for (const card of MAJOR_ARCANA) {
    if (drawnSet.has(card.name)) continue;
    const name = card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = AMBIGUOUS.has(card.name)
      ? new RegExp(`(${name})\\s*카드|카드[^.]{0,6}(${name})`)
      : new RegExp(name);
    if (pattern.test(allText)) {
      out.push({
        kind: "카드",
        where: "report",
        detail: `뽑지 않은 카드 "${card.name}" 를 말했다`,
        blocking: true,
      });
    }
  }

  // ── 새 검사 2: 자리 셋과 카드 이름이 맞는가 ──
  if (report.cards.length !== draw.cards.length) {
    out.push({
      kind: "구조",
      where: "cards",
      detail: `자리가 ${draw.cards.length}인데 ${report.cards.length}개 왔다`,
      blocking: true,
    });
  }
  report.cards.forEach((section, i) => {
    const expected = draw.cards[i];
    if (!expected) return;
    if (section.cardName !== expected.card.name) {
      out.push({
        kind: "구조",
        where: `cards[${i}]`,
        detail: `${expected.positionLabel} 는 "${expected.card.name}" 인데 "${section.cardName}" 로 썼다`,
        blocking: true,
      });
    }
    if (!section.read || section.read.trim().length < 40) {
      out.push({
        kind: "구조",
        where: `cards[${i}].read`,
        detail: "해석이 너무 짧다",
        blocking: true,
      });
    }
  });

  if (!report.closing || report.closing.trim().length < 10) {
    out.push({ kind: "구조", where: "closing", detail: "묶는 문장이 없다", blocking: true });
  }

  // ── 새 검사 3: 카드가 나온 이유를 명식으로 설명했는가 ──
  for (const [pattern, label] of CAUSAL_PATTERNS) {
    if (pattern.test(allText)) {
      out.push({
        kind: "인과",
        where: "report",
        detail: `카드와 명식을 인과로 이었다 — ${label}`,
        blocking: true,
      });
    }
  }

  return { ok: !out.some((v) => v.blocking), violations: out };
}
