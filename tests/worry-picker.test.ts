// 고민 고르기 — 카드마다 그림이 있는지.
//
// 이 줄은 상품 카드(cards-pastel)를 안 쓰고 자기 그림을 따로 쓴다. 고민 id 를
// 늘리면서 그림을 안 넣으면 화면에 깨진 그림 표식이 나가므로 여기서 잡는다.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { PRODUCT_MAP } from "../src/lib/products";
import { WORRY_IDS } from "../src/components/worry-ids";

const DIR = path.join(process.cwd(), "public", "worry");

test("고민마다 그림이 있다", () => {
  for (const id of WORRY_IDS) {
    const file = path.join(DIR, `${id}.jpg`);
    assert.ok(fs.existsSync(file), `${id} 의 그림이 없다 — public/worry/${id}.jpg`);
    const bytes = fs.statSync(file).size;
    assert.ok(bytes > 5_000, `${id} 이 너무 작다 (${bytes}바이트)`);
    assert.ok(bytes < 500_000, `${id} 이 ${Math.round(bytes / 1024)}KB 다 — 줄여서 넣는다`);
  }
});

test("고민 id 는 전부 실제 상품이다", () => {
  // 문구를 상품의 headline 에서 가져오므로, 없는 상품이면 카드가 빈 채로 선다.
  for (const id of WORRY_IDS) {
    assert.ok(PRODUCT_MAP[id], `${id} 는 상품이 아니다`);
    assert.ok(PRODUCT_MAP[id].headline.endsWith("?"), `${id} 의 headline 이 물음이 아니다`);
  }
});

test("쓰지 않는 그림을 두지 않는다", () => {
  const known = new Set<string>(WORRY_IDS);
  for (const file of fs.readdirSync(DIR)) {
    if (!file.endsWith(".jpg")) continue;
    assert.ok(known.has(file.slice(0, -4)), `${file} 은 어느 고민도 아니다`);
  }
});
