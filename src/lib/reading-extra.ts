// 절마다 하나씩 얹을 수 있는 다른 모양의 덩어리.
//
// 지금까지 열다섯 개 절이 전부 같은 모양이었다 — 요약 한 덩어리, 문단 셋, 살펴볼 점,
// 근거 칩. 한 절이 1,200자니까 그 모양이 열다섯 번 반복되면 세 번째 장쯤에서
// 눈이 미끄러진다. 내용이 지루한 게 아니라 **모양이 지루한 것**이다.
//
// 그래서 절마다 다른 모양을 하나씩 얹을 수 있게 한다. 새로운 내용을 더하는 게 아니라,
// 그 절이 이미 말한 것 중 하나를 **다른 꼴로 다시 세우는 것**이다.
//   · 결론 한 문장 -> 크게 뽑아낸 인용
//   · 나와 상대의 차이 -> 두 칸 대조
//   · 시기 이야기 -> 시간순 목록
//   · 할 일 -> 체크 목록
//
// 규칙 하나: **모든 절에 붙이지 않는다.** 매 절에 다른 모양이 나오면 그것대로 산만하고,
// 어느 절이 중요한지도 사라진다. 절반쯤에만, 종류를 바꿔 가며 붙인다.

export type SectionExtra =
  | { kind: "quote"; text: string }
  | { kind: "contrast"; mine: string; theirs: string }
  | { kind: "timeline"; points: { when: string; what: string }[] }
  | { kind: "checklist"; items: string[] };

export const EXTRA_KINDS = ["quote", "contrast", "timeline", "checklist"] as const;

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * 모델이 보낸 것을 안전한 모양으로 좁힌다.
 *
 * 모양이 조금이라도 어긋나면 **버린다.** 이건 덤이라, 반쯤 망가진 채로 화면에 세우는
 * 것보다 없는 편이 낫다. 본문은 이것과 무관하게 온전하다.
 */
export function parseExtra(raw: unknown): SectionExtra | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const kind = str(row.kind);

  if (kind === "quote") {
    const text = str(row.text);
    // 너무 짧으면 인용이 아니고, 너무 길면 뽑아낸 게 아니다
    return text.length >= 10 && text.length <= 120 ? { kind, text } : undefined;
  }

  if (kind === "contrast") {
    const mine = str(row.mine);
    const theirs = str(row.theirs);
    return mine && theirs ? { kind, mine, theirs } : undefined;
  }

  if (kind === "timeline") {
    if (!Array.isArray(row.points)) return undefined;
    const points = row.points
      .map((point) => {
        const p = point as Record<string, unknown>;
        return { when: str(p.when), what: str(p.what) };
      })
      .filter((point) => point.when && point.what)
      .slice(0, 4);
    return points.length >= 2 ? { kind, points } : undefined;
  }

  if (kind === "checklist") {
    if (!Array.isArray(row.items)) return undefined;
    const items = row.items.map(str).filter(Boolean).slice(0, 4);
    return items.length >= 2 ? { kind, items } : undefined;
  }

  return undefined;
}

/** 저장되는 원문에 실을 줄글. 화면 밖으로 나갈 때는 모양을 잃고 내용만 남는다. */
export function extraToText(extra: SectionExtra | undefined, plain: (text: string) => string): string {
  if (!extra) return "";
  switch (extra.kind) {
    case "quote":
      return `“${plain(extra.text)}”`;
    case "contrast":
      return `나: ${plain(extra.mine)}\n상대: ${plain(extra.theirs)}`;
    case "timeline":
      return extra.points.map((point) => `${plain(point.when)} — ${plain(point.what)}`).join("\n");
    case "checklist":
      return extra.items.map((item) => `· ${plain(item)}`).join("\n");
  }
}

/**
 * 몇 번째 절에 어떤 모양을 얹을지 **서버가 정한다.**
 *
 * 모델에게 고르라고 맡겼더니 열다섯 절 중 일곱에 모양이 붙었는데 그중 다섯이
 * contrast 였다. 묶음마다 따로 생성되니 옆 묶음이 뭘 골랐는지 알 수 없고, 각자
 * 그 절에 가장 어울리는 하나를 고르면 결국 같은 것에 몰린다. 모양을 섞으려고 넣은
 * 장치가 오히려 한 가지로 수렴한 셈이다.
 *
 * 그래서 배분은 여기서 한다. 홀수 번째 절에만, 종류를 돌아가며.
 * 모델은 "이 절에 이걸 붙여라" 를 받고, 그 절에 맞지 않으면 비워도 된다.
 */
export function extraPlanFor(index: number): (typeof EXTRA_KINDS)[number] | null {
  if (index % 2 === 0) return null;
  return EXTRA_KINDS[Math.floor(index / 2) % EXTRA_KINDS.length];
}
