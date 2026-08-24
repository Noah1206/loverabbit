import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// 상품 카드 그림에서 세로형·가로형 광고 배경을 뜬다.
//
//   node marketing/ads/derive-card-bg.mjs
//
// 왜 있는가. 세로형(compose-hook-five-v1)과 화이트형(compose-white-five-v1)은
// 941x1672 · 1734x907 배경 파일을 먹는다. 그 배경들은 주제마다 따로 만든 AI
// 원화라, 새 주제를 더하려면 그림부터 있어야 한다. 재회에는 그 원화가 없었고,
// 그래서 정사각 두 장만 있고 스토리·릴스 지면에 올릴 것이 없었다.
//
// 대신 그 상품이 사이트에서 실제로 쓰는 카드(public/cards-pastel/<id>.jpg,
// 900x1200)에서 뜬다. 클릭 뒤에 같은 그림이 나오는 것은 오히려 이점이다.
//
// **이건 확대다.** 900px 원본을 1734px 까지 늘린다. 애니풍 그림이라 눈에 잘
// 띄지는 않지만 원화를 새로 만든 것과 같지 않다. 여유가 생기면 이 배경을
// 갈아 끼우는 편이 낫다 - 파일 이름만 맞추면 생성기는 그대로 돈다.
//
// 세로는 기본이 cover + attention 이다. 3:4 를 9:16 으로 늘리는 것이라 좌우만
// 조금 잘리고 인물은 거의 그대로 남는다. attention 이 엉뚱한 데를 잡는 그림은
// vertical 에 배율과 좌표를 직접 적는다.
//
// 가로는 다르다. 3:4 에서 1.9:1 을 뜨면 세로의 39% 만 남아서, 가운데를 뜨면
// 머리가 잘린다. 그래서 폭에 맞춰 늘린 뒤 **위에서 얼마나 내려온 자리**를
// 띠로 뜰지 항목마다 적어 둔다 (landscapeTop). 뽑아 보고 정한 값이다.

const root = process.cwd();

const V = { width: 941, height: 1672 };
const H = { width: 1734, height: 907 };

// 배율과 좌표를 직접 적은 자리를 뜬다. 좌표는 배율을 먹인 그림 기준이고,
// 화면 밖으로 나가면 안쪽으로 당긴다 - 값을 잘못 적어도 깨지지 않게.
async function cropAt(src, { scale, left, top }, size) {
  const meta = await sharp(src).metadata();
  const widened = await sharp(src)
    .resize({ width: Math.round(meta.width * scale), kernel: "lanczos3" })
    .toBuffer();
  const w = await sharp(widened).metadata();
  if (w.width < size.width || w.height < size.height) {
    throw new Error(`scale ${scale} 로는 ${size.width}x${size.height} 가 안 나온다.`);
  }
  return sharp(widened)
    .extract({
      left: Math.max(0, Math.min(left, w.width - size.width)),
      top: Math.max(0, Math.min(top, w.height - size.height)),
      width: size.width,
      height: size.height,
    })
    .png()
    .toBuffer();
}

const items = [
  {
    id: "jaehoe",
    card: "jaehoe.jpg",
    // 300 에서 두 사람 얼굴이 다 남고, 왼쪽 3분의 1이 비 내리는 창이라
    // 헤드라인이 앉을 자리가 빈다. 140 은 여자 쪽 이마가 잘렸고,
    // 가운데(cover 기본값)는 둘 다 목 위가 날아갔다.
    landscapeTop: 300,
    out: [
      ["marketing/ads/hook-five-v1", "06-jaehoe-vertical-bg.png", "vertical"],
      ["marketing/ads/hook-five-v1", "06-jaehoe-horizontal-bg.png", "horizontal"],
      // 화이트형은 배경을 public/ads/saju 에서 읽는다. 사이트가 쓰는 그림은
      // 아니고 그 생성기만 보는 자리다.
      ["public/ads/saju", "jaehoe-bg.png", "vertical"],
    ],
  },
  {
    id: "yeonae",
    card: "yeonae.jpg",
    // 세로는 기본값(cover + attention)이 두 번 틀렸다. 인물이 왼쪽 끝으로
    // 밀려 귀가 잘렸고, 가슴선이 화면 한가운데(52%)에 왔다. 후킹형 세로
    // 레이아웃은 42~76% 구간이 베일 없이 그대로 보이는 자리라, 하필 거기다.
    //
    // 2.6배로 당겨 두 얼굴만 남기면 목선 아래가 88% 로 내려가 CTA 버튼과
    // 아래쪽 어두운 띠 뒤로 들어간다. 파는 것은 올해의 연애 흐름이지 성인
    // 소재가 아니다 - 그림이 그렇게 읽히면 심의도 위험하고 상품도 오해받는다.
    // 2.15 로도 해 봤는데 가슴선이 78%, 즉 CTA 바로 위에 그대로 남았다.
    vertical: { scale: 2.6, left: 700, top: 0 },
    // 220 에서 두 얼굴이 다 남고 띠가 가슴선 위에서 끝난다. 왼쪽 3분의 1이
    // 장미와 촛불이라 헤드라인이 앉을 자리가 빈다.
    landscapeTop: 220,
    out: [
      ["marketing/ads/hook-five-v1", "07-yeonae-year-vertical-bg.png", "vertical"],
      ["marketing/ads/hook-five-v1", "07-yeonae-year-horizontal-bg.png", "horizontal"],
    ],
  },
];

for (const item of items) {
  const src = path.join(root, "public", "cards-pastel", item.card);

  // 카드 중에는 캔버스에 검은 여백이 박힌 것이 있다(insun.jpg 가 그랬다).
  // 그대로 늘리면 여백만 남거나 좁은 띠를 두 배로 늘려 뭉갠다. 여기서 센다.
  const meta = await sharp(src).metadata();
  const trimmed = await sharp(src).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const shrink = Math.min(trimmed.info.width / meta.width, trimmed.info.height / meta.height);
  if (shrink < 0.85) {
    throw new Error(
      `${item.card} 는 캔버스에 여백이 박혀 있다 (실제 그림 ${trimmed.info.width}x${trimmed.info.height} / ` +
      `캔버스 ${meta.width}x${meta.height}). 배경으로 못 쓴다.`
    );
  }

  const vertical = item.vertical
    ? await cropAt(src, item.vertical, V)
    : await sharp(src)
        .resize(V.width, V.height, { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" })
        .png()
        .toBuffer();

  const widened = await sharp(src).resize({ width: H.width, kernel: "lanczos3" }).toBuffer();
  const widenedMeta = await sharp(widened).metadata();
  const top = Math.min(item.landscapeTop, widenedMeta.height - H.height);
  if (top < 0) {
    throw new Error(`${item.card} 는 폭에 맞춰 늘려도 ${H.height}px 띠가 안 나온다.`);
  }
  const horizontal = await sharp(widened)
    .extract({ left: 0, top, width: H.width, height: H.height })
    .png()
    .toBuffer();

  for (const [dir, name, kind] of item.out) {
    const outDir = path.join(root, dir);
    await mkdir(outDir, { recursive: true });
    await sharp(kind === "vertical" ? vertical : horizontal).toFile(path.join(outDir, name));
    console.log(`  ${dir}/${name}  (${kind})`);
  }
}

console.log(`Derived backgrounds for ${items.length} card(s)`);
