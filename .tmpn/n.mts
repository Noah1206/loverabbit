import { chaptersOf } from "../src/lib/reading-compose";
import { PRODUCTS } from "../src/lib/products";
for (const id of ["insun","ibyeol"]) {
  const p = PRODUCTS.find(x=>x.id===id)!;
  const c = chaptersOf(p.toc);
  console.log(`${id}: 목차 ${p.toc.length}절 -> 조각 ${c.length}개 + head 1 = ${c.length+1} 요청`);
}
