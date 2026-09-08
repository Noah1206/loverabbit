import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, displayToc } from "../src/lib/products";

/*
  tocPlain 은 toc 와 **같은 순서 같은 개수**여야 한다. 어긋나면 목차 3번째
  줄이 본문 4번째 절을 가리키게 되는데, 화면은 멀쩡해 보인다 — 조용한 실패라
  검사로 막는다.
*/

test("쉬운 목차는 원래 목차와 개수가 같다", () => {
  for (const p of PRODUCTS) {
    if (!p.tocPlain) continue;
    assert.equal(
      p.tocPlain.length,
      p.toc.length,
      `${p.id}: 쉬운 목차 ${p.tocPlain.length}줄, 원래 ${p.toc.length}줄`
    );
  }
});

test("쉬운 목차에는 장 번호와 명리 용어가 없다", () => {
  // 그것을 걷으려고 만든 필드다. 남아 있으면 만든 뜻이 없다.
  const jargon = ["일주", "십성", "지장간", "신살", "대운", "세운"];
  for (const p of PRODUCTS) {
    if (!p.tocPlain) continue;
    for (const line of p.tocPlain) {
      assert.ok(!/^\d+장/.test(line), `${p.id}: "${line}" 에 장 번호가 남았다`);
      assert.ok(!/^\d+\./.test(line), `${p.id}: "${line}" 에 번호가 남았다`);
      for (const w of jargon) {
        assert.ok(!line.includes(w), `${p.id}: "${line}" 에 "${w}" 가 남았다`);
      }
    }
  }
});

test("쉬운 목차의 줄은 비어 있지 않고 너무 길지 않다", () => {
  for (const p of PRODUCTS) {
    if (!p.tocPlain) continue;
    for (const line of p.tocPlain) {
      assert.ok(line.trim().length >= 4, `${p.id}: "${line}" 이 너무 짧다`);
      /* 한 줄에 안 들어가면 목록이 아니라 문단이 된다.
         30자인 이유: "스킨십 — 어디서부터 얼마나 빠르게" 처럼 무엇을 알게 되는지
         적으려면 22자로는 모자란다. 짧게 줄이면 다시 추상적인 제목이 된다. */
      assert.ok(line.length <= 30, `${p.id}: "${line}" 이 너무 길다 (${line.length}자)`);
    }
  }
});

test("displayToc 은 항상 원래 목차와 같은 개수를 준다", () => {
  // 개수가 어긋난 tocPlain 이 들어와도 화면이 밀리지 않아야 한다.
  for (const p of PRODUCTS) {
    assert.equal(displayToc(p).length, p.toc.length, `${p.id} 의 표시 목차 개수가 다르다`);
  }
});

test("쉬운 목차를 넣은 상품은 줄이 서로 다르다", () => {
  for (const p of PRODUCTS) {
    if (!p.tocPlain) continue;
    assert.equal(new Set(p.tocPlain).size, p.tocPlain.length, `${p.id} 의 목차에 같은 줄이 둘 있다`);
  }
});
