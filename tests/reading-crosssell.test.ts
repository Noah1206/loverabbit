import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, type Product } from "../src/lib/products";

/*
  리딩 끝의 "다음 질문" 추천을 고르는 규칙.

  page.tsx 안의 useMemo 와 같은 규칙을 여기 옮겨 둔다. 화면 코드를 그대로
  부를 수 없어서(리액트 훅) 규칙만 복제하는데, 그래서 **둘이 갈라질 수 있다**
  — 화면을 고칠 때 이 파일도 같이 고쳐야 한다. 그 대신 이 검사가 지키는 것은
  "무엇이 나오는가" 가 아니라 "쏠리지 않는가" 다.
*/
function pickNext(product: Product): Product[] {
  const rank = (p: Product) => [
    product.needsPartner || p.needsPartner ? 0 : 1,
    p.tags.includes("popular") ? 0 : 1,
    p.price,
  ];
  const sorted = PRODUCTS.filter((p) => p.id !== product.id).sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });
  const picked: Product[] = sorted.slice(0, 1);
  const used = new Set<string>(picked.map((p) => p.topic));
  for (const p of sorted) {
    if (picked.length >= 3) break;
    if (used.has(p.topic)) continue;
    used.add(p.topic);
    picked.push(p);
  }
  for (const p of sorted) {
    if (picked.length >= 4) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}

test("어떤 상품을 봐도 추천이 넷 나온다", () => {
  for (const p of PRODUCTS) {
    assert.equal(pickNext(p).length, 4, `${p.id} 의 추천이 넷이 아니다`);
  }
});

test("방금 본 것은 추천에 다시 나오지 않는다", () => {
  for (const p of PRODUCTS) {
    assert.ok(
      !pickNext(p).some((n) => n.id === p.id),
      `${p.id} 가 자기 자신을 추천한다`
    );
  }
});

test("같은 상품이 두 번 들어가지 않는다", () => {
  for (const p of PRODUCTS) {
    const ids = pickNext(p).map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, `${p.id} 의 추천에 중복이 있다`);
  }
});

test("주제가 한쪽으로 쏠리지 않는다 — 앞의 셋은 서로 다른 주제다", () => {
  // 둘만 보여주던 때는 연애를 본 사람에게 연애만 둘 나왔다. 그 쏠림을 막으려고
  // 넣은 규칙이라, 이것이 이 변경의 전부다.
  for (const p of PRODUCTS) {
    const top3 = pickNext(p).slice(0, 3);
    const topics = new Set(top3.map((n) => n.topic));
    assert.equal(topics.size, top3.length, `${p.id} 의 추천 주제가 겹친다`);
  }
});

test("혼자 보는 리딩 뒤에는 상대가 필요한 것을 먼저 올린다", () => {
  /*
    rank 의 첫 항이 `product.needsPartner || p.needsPartner ? 0 : 1` 이라,
    **이미 상대 정보를 낸 사람**에게는 이 항이 모두 0이 되어 갈리지 않는다
    (그 사람은 어느 쪽을 골라도 손해가 없다). 갈리는 것은 혼자 본 사람 쪽이다 —
    그때 "그 사람이 필요한 리딩" 을 앞에 세워 상대를 떠올리게 한다.

    처음에 이 검사를 "상대가 필요한 리딩을 본 사람" 으로 썼다가 틀렸다.
    코드가 아니라 검사의 전제가 잘못돼 있었다.
  */
  const solo = PRODUCTS.find((p) => !p.needsPartner);
  assert.ok(solo, "혼자 보는 상품이 하나도 없다");
  assert.equal(pickNext(solo)[0].needsPartner, true, "혼자 본 뒤 첫 추천이 혼자용이다");
});
