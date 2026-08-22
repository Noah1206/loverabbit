import { existsSync } from "node:fs";
import path from "node:path";

import { PRODUCTS } from "@/lib/products";
import { EMOTION_TAGS, type EmotionTag } from "@/lib/reading-asset-selector";
import { elementFromChart, planImagesFor } from "@/lib/reading-asset-plan";
import { TALISMAN_SLOT } from "@/lib/reading-image-shape";

// 사전 제작 삽화가 14개 상품 전부에서 제대로 뽑히는지 확인한다.
//
// 리딩을 실제로 만들어 보려면 AI 를 불러야 하고 그건 돈이다. 그림 선택은 글과
// 무관하게 감정 태그 x 컷 위치 x 일간 오행으로만 정해지므로, 그 셋만 바꿔가며
// 돌리면 화면을 열지 않고도 전부 확인된다.
//
//   npx tsx --tsconfig tsconfig.json scripts/verify-love-rabbit-assets.mts

const root = process.cwd();
const ELEMENTS = ["목", "화", "토", "금", "수"] as const;
const failures: string[] = [];
const note = (message: string) => failures.push(message);

// 상품마다 결이 다르므로 태그 조합도 다르게 준다. 실제 모델이 낼 법한 모양.
function tagsFor(index: number): EmotionTag[][] {
  const rotate = (offset: number) => EMOTION_TAGS[(index + offset) % EMOTION_TAGS.length];
  return [
    [rotate(0)],
    [rotate(1), rotate(2)],
    [rotate(3)],
    [rotate(4), rotate(5)],
    [rotate(6)],
  ];
}

function chartFor(element: (typeof ELEMENTS)[number]): string {
  return `연주 갑자 (띠: 쥐), 월주 병인, 일주 무진 (일간 오행: ${element}), 시주 경신`;
}

console.log(`상품 ${PRODUCTS.length}개 x 오행 ${ELEMENTS.length}개 = ${PRODUCTS.length * ELEMENTS.length}가지 확인\n`);

for (const [index, product] of PRODUCTS.entries()) {
  for (const element of ELEMENTS) {
    const chart = chartFor(element);
    const images = planImagesFor({
      chapterNumbers: [1, 2, 3, 4, 5],
      chapterEmotionTags: tagsFor(index),
      chart,
      label: product.shortLabel,
    });

    const where = `${product.id}/${element}`;

    // 1) 여섯 자리가 다 찬다
    if (images.length !== 6) note(`${where} - 그림이 ${images.length}장 (6장이어야 함)`);
    if (images.some((image) => image.status !== "ready")) note(`${where} - ready 가 아닌 자리가 있다`);

    // 2) 5컷 순서가 장 번호와 맞는다
    const scenes = images.filter((image) => image.chapter !== TALISMAN_SLOT);
    if (scenes.map((s) => s.chapter).join(",") !== "1,2,3,4,5") {
      note(`${where} - 컷 순서가 어긋난다: ${scenes.map((s) => s.chapter).join(",")}`);
    }

    // 3) 한 리딩 안에서 같은 그림을 두 번 쓰지 않는다
    const urls = scenes.map((s) => s.url ?? "");
    if (new Set(urls).size !== urls.length) note(`${where} - 같은 그림이 두 번 쓰였다`);

    // 4) 부적이 일간 오행과 맞는다
    const talisman = images.find((image) => image.chapter === TALISMAN_SLOT);
    const expected = elementFromChart(chart);
    if (!talisman?.url?.includes(elementFile(expected))) {
      note(`${where} - 부적 오행 불일치: ${talisman?.url}`);
    }

    // 5) 파일이 실제로 디스크에 있다 (원본 png 와 화면용 webp 둘 다)
    for (const image of images) {
      const rel = (image.url ?? "").replace(/^\//, "");
      const webp = path.join(root, "public", rel);
      const png = webp.replace(/\.webp$/, ".png");
      if (!existsSync(webp)) note(`${where} - webp 없음: ${rel}`);
      if (!existsSync(png)) note(`${where} - 원본 png 없음: ${rel.replace(/\.webp$/, ".png")}`);
    }

    // 6) 낭독기 설명에 금지된 말이 없다
    const banned = /눈물|우는|울음|쓰러|의식|병원|병실|상해|사망|자해|폭력|공포|위협|구속/;
    for (const image of images) {
      if (banned.test(image.alt ?? "")) note(`${where} - 금지어가 설명에 있다: ${image.alt}`);
    }
  }
}

function elementFile(element: string): string {
  return (
    { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }[element] ?? "earth"
  );
}

// 태그가 아예 없는 옛 리딩도 확인한다 — 여기가 비면 화면에 빈칸이 생긴다.
const legacy = planImagesFor({ chapterNumbers: [1, 2, 3, 4, 5], chapterEmotionTags: [], chart: null });
if (legacy.length !== 6 || legacy.some((image) => !image.url)) {
  note("태그 없는 옛 리딩에서 자리가 빈다");
}

if (failures.length === 0) {
  console.log("[OK] 모든 조합에서 5컷 + 부적이 정상입니다.");
  console.log("     - 컷 순서 1~5, 중복 없음, 부적 오행 일치, 파일 존재, 금지어 없음");
  process.exit(0);
}

console.error(`[FAIL] ${failures.length}건`);
for (const failure of failures.slice(0, 30)) console.error("  " + failure);
process.exit(1);
