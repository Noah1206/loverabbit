// 맛보기 카드와 잠긴 목차가 번호를 다투지 않는가.
//
// 슬림 무료 미리보기(FREE_PREVIEW_V2)가 만드는 카드 세 장은 목차에 없는 자유
// 제목이다. 그동안 목차 절과 한 덩어리로 번호를 매겨서, 한 화면에 1) 이 두 번
// 나왔다 — 카드가 1) 2) 3) 을 먹고 잠긴 "1장 01" 이 다시 1) 이 됐다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildChapters, previewPieces } from "@/lib/reading-chapters";

const TOC = [
  "1장 01. 네 일주가 만드는 끌림의 기본 패턴",
  "1장 02. 그 사람 일주에 새겨진 관계 습관",
  "2장 01. 두 사람이 처음부터 끌릴 수밖에 없던 구조",
];

const chaptersOf = (preview: { title: string; excerpt: string }[]) =>
  buildChapters(previewPieces(preview, TOC, TOC), { toc: TOC });

describe("맛보기 카드와 목차 절의 번호", () => {
  it("한 장 안에서 같은 번호가 두 번 나오지 않는다", () => {
    const chapters = chaptersOf([
      { title: "같은 쪽으로 기우는 힘", excerpt: "두 배우자 자리가 같은 국에 모여." },
      { title: "사람을 끄는 자리", excerpt: "시선을 모으는 기운이 앉아 있어." },
    ]);
    for (const chapter of chapters) {
      const numbered = chapter.sections.map((s) => s.order).filter((n) => n > 0);
      assert.equal(new Set(numbered).size, numbered.length, `${chapter.label} 에서 번호가 겹쳤다`);
    }
  });

  it("목차에 없는 제목은 번호를 안 받는다", () => {
    const chapters = chaptersOf([{ title: "같은 쪽으로 기우는 힘", excerpt: "본문." }]);
    const card = chapters.flatMap((c) => c.sections).find((s) => s.title === "같은 쪽으로 기우는 힘");
    assert.ok(card, "맛보기 카드가 화면에서 사라지면 안 된다");
    assert.equal(card!.order, 0);
  });

  it("목차에 있는 제목은 그대로 번호를 받는다", () => {
    // 예전 경로 — 미리보기가 실제 첫 절들이었다. 그때는 번호가 붙어야 맞다.
    const chapters = chaptersOf([{ title: "네 일주가 만드는 끌림의 기본 패턴", excerpt: "본문." }]);
    const section = chapters.flatMap((c) => c.sections).find((s) => s.title.includes("끌림의 기본 패턴"));
    assert.ok(section);
    assert.ok(section!.order > 0, "목차 절인데 번호를 못 받았다");
  });
});
