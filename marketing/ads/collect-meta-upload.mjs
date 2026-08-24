import { mkdir, copyFile, writeFile, rm, access } from "node:fs/promises";
import path from "node:path";

// 메타에 올릴 소재를 광고별 폴더로 모은다.
//
//   node marketing/ads/collect-meta-upload.mjs
//
// 소재는 네 폴더에 흩어져 있다 - 어두운 세트, 화이트 세트, 스크린샷 세트,
// 그리고 같은 틀에 배경만 홈 그리드 카드로 바꾼 세트. 광고 하나를 만들 때마다
// 네 폴더를 오가며 골라내는 것은 실수가 나기 좋다.
// 여기서 광고별로 한 폴더에 모아 두면 폴더째 끌어 올리면 된다.
//
// 원본은 건드리지 않고 복사만 한다. 이 폴더는 .gitignore 에 있다 - 같은 그림을
// 저장소에 두 번 넣을 이유가 없다. 필요하면 이 스크립트를 다시 돌리면 된다.
//
// jpg 만 모은다. png 는 같은 그림인데 다섯 배 무거워서 업로드만 느리다.

const root = process.cwd();
const adsDir = path.join(root, "marketing", "ads");
const outDir = path.join(adsDir, "meta-upload-v1");

const DARK = "hook-five-v1";
const WHITE = "white-five-v1";
const SQUARE = "shrine-square-v1";
// 같은 틀에 배경만 홈 그리드 카드로 바꾼 벌. 파일 이름이 같아서 접두어를 붙인다.
const CARD = "card-square-v1";

const ads = [
  // 켜는 광고는 넷이다 (2026-08-24 에 재회가 붙었다). 전용 랜딩이 있는 것은
  // /saju/<랜딩> 을, 없는 것은 상품 상세를 쓴다 - 두 화면이 같은 판매 화면이다.
  //
  // 뺀 넷 - 궁합(compatibility_990) / 19금(mature_compatibility_990) /
  // 바람기(baramgi_990) / 도화(dohwasal_990). 소재도 오퍼도 그대로 살아 있으니
  // 되돌리려면 git 에서 이 배열의 예전 항목을 가져와 붙이면 된다.
  {
    dir: "01-속궁합",
    landing: "/saju/intimate-compatibility",
    offer: "intimate_compatibility_990",
    product: "속궁합 사주 9,900 -> 990",
    headline: "겉궁합은 좋은데 속궁합은 어떨까",
    sources: [
      [DARK, "02-intimate-compatibility-ad-feed-1080x1350.jpg"],
      [DARK, "02-intimate-compatibility-ad-vertical-1080x1920.jpg"],
      [DARK, "02-intimate-compatibility-ad-horizontal-1200x628.jpg"],
      [WHITE, "02-intimate-feed-1080x1350.jpg"],
      [WHITE, "02-intimate-story-1080x1920.jpg"],
      [SQUARE, "03-intimate-square-1080x1080.jpg"],
      [CARD, "03-intimate-square-1080x1080.jpg", "카드-"],
      // 상품 카드 그림으로 만든 한 벌. 도착 화면과 소재의 그림이 같다.
      // 02 와 각도가 다르다 - 02 는 속궁합 지수, 09 는 주도권. 섞어 쓰지 마라.
      [DARK, "09-sokgunghap-ad-feed-1080x1350.jpg"],
      [DARK, "09-sokgunghap-ad-vertical-1080x1920.jpg"],
      [DARK, "09-sokgunghap-ad-horizontal-1200x628.jpg"],
    ],
  },
  {
    dir: "02-연애운",
    // 인연 타이밍(insun)은 올해의 연애운(yeonae)으로 합쳐졌다 (2026-08-24).
    // 목적지를 합쳐진 상품 주소로 옮기고 오퍼도 그 상품 것으로 바꾼다.
    // 창이 열리는 시기 / 만남의 경로 / 상대의 윤곽은 없어진 게 아니라 이 상품
    // 목차 4장으로 들어갔다 - 소재의 각도는 그대로 살아 있다.
    landing: "/product/yeonae",
    offer: "yeonae_990",
    product: "올해의 연애운 14,900 -> 990",
    headline: "올해도 그냥 지나가는 걸까",
    // 이미 게시된 광고는 예전 주소를 들고 있다. 그쪽도 같은 상품을 990원에
    // 그대로 파므로 끄거나 고칠 필요가 없다는 것을 폴더 안내에 적어 둔다.
    note: [
      "이미 게시된 광고는 /saju/romance-timing?offer=romance_timing_990 을 들고",
      "있다. 그 주소도 같은 상품을 990원에 그대로 판다 - 끄거나 고칠 필요 없다.",
      "새로 만드는 광고만 위 주소를 쓴다.",
    ],
    sources: [
      [DARK, "04-romance-fortune-ad-feed-1080x1350.jpg"],
      [DARK, "04-romance-fortune-ad-vertical-1080x1920.jpg"],
      [DARK, "04-romance-fortune-ad-horizontal-1200x628.jpg"],
      [WHITE, "04-romance-timing-feed-1080x1350.jpg"],
      [WHITE, "04-romance-timing-story-1080x1920.jpg"],
      [SQUARE, "04-romance-timing-square-1080x1080.jpg"],
      [CARD, "04-romance-timing-square-1080x1080.jpg", "카드-"],
      // 합쳐진 상품이 실제로 쓰는 그림으로 만든 한 벌. 도착 화면과 소재의 그림이
      // 같아서 클릭 뒤 이질감이 가장 적다. 정사각 · 세로 · 가로 셋이 같은
      // 그림에서 나온다 (배경은 derive-card-bg.mjs 가 그 카드에서 뜬다).
      [SQUARE, "08-yeonae-year-square-1080x1080.jpg"],
      [CARD, "08-yeonae-year-square-1080x1080.jpg", "카드-"],
      [DARK, "07-yeonae-year-ad-feed-1080x1350.jpg"],
      [DARK, "07-yeonae-year-ad-vertical-1080x1920.jpg"],
      [DARK, "07-yeonae-year-ad-horizontal-1200x628.jpg"],
    ],
  },
  {
    dir: "03-이별",
    landing: "/saju/breakup-decision",
    offer: "breakup_decision_990",
    product: "이별 부검 리포트 29,900 -> 990",
    headline: "내가 뭘 그렇게 잘못했을까",
    sources: [
      [DARK, "05-breakup-ad-feed-1080x1350.jpg"],
      [DARK, "05-breakup-ad-vertical-1080x1920.jpg"],
      [DARK, "05-breakup-ad-horizontal-1200x628.jpg"],
      [WHITE, "05-breakup-feed-1080x1350.jpg"],
      [WHITE, "05-breakup-story-1080x1920.jpg"],
      [SQUARE, "01-breakup-square-1080x1080.jpg"],
      [CARD, "01-breakup-square-1080x1080.jpg", "카드-"],
      // 상품 카드 그림으로 만든 한 벌. 도착 화면과 소재의 그림이 같다.
      // 05 와 각도가 다르다 - 05 는 자책, 08 은 반복. 섞어 쓰지 마라.
      [DARK, "08-ibyeol-ad-feed-1080x1350.jpg"],
      [DARK, "08-ibyeol-ad-vertical-1080x1920.jpg"],
      [DARK, "08-ibyeol-ad-horizontal-1200x628.jpg"],
    ],
  },
  {
    dir: "04-재회",
    // 재회는 전용 랜딩이 없다. 상품 상세가 곧 랜딩이다.
    landing: "/product/jaehoe",
    offer: "jaehoe_990",
    product: "재회 사주 14,900 -> 990",
    headline: "아직 연락 올까 싶어서",
    note: [
      "세로형·가로형·피드 배경은 AI 원화가 아니라 상품 카드에서 뜬 것이다",
      "(marketing/ads/derive-card-bg.mjs). 900px 원본을 늘린 것이라 원화를",
      "새로 만들면 그 배경 파일만 갈아 끼우고 생성기를 다시 돌리면 된다.",
    ],
    sources: [
      [DARK, "06-jaehoe-ad-feed-1080x1350.jpg"],
      [DARK, "06-jaehoe-ad-vertical-1080x1920.jpg"],
      [DARK, "06-jaehoe-ad-horizontal-1200x628.jpg"],
      [WHITE, "06-jaehoe-feed-1080x1350.jpg"],
      [WHITE, "06-jaehoe-story-1080x1920.jpg"],
      [SQUARE, "09-jaehoe-square-1080x1080.jpg"],
      [CARD, "09-jaehoe-square-1080x1080.jpg", "카드-"],
    ],
  },
];

const UTM = "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}";
const BASE = "https://loverebbit.xyz";

const exists = async (p) => access(p).then(() => true).catch(() => false);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const missing = [];
let copied = 0;

for (const ad of ads) {
  const dir = path.join(outDir, ad.dir);
  await mkdir(dir, { recursive: true });

  const lines = [];
  for (const [set, file, prefix = ""] of ad.sources) {
    const from = path.join(adsDir, set, file);
    if (!(await exists(from))) {
      missing.push(`${set}/${file}`);
      continue;
    }
    await copyFile(from, path.join(dir, prefix + file));
    copied += 1;
    lines.push(`  ${prefix + file}   (${set})`);
  }

  // Windows 메모장이 한글을 제대로 열도록 BOM 을 붙인다. BOM 이 없으면
  // 시스템 코드페이지로 읽으려다 깨지는 일이 있다.
  const readme = "﻿" + [
    `[${ad.dir}]`,
    ``,
    `랜딩   ${BASE}${ad.landing}?offer=${ad.offer}`,
    `상품   ${ad.product}`,
    `헤드라인  ${ad.headline}`,
    ``,
    `웹사이트 URL 에 아래를 통째로 넣는다. URL 매개변수 칸은 비운다`,
    `(넣으면 UTM 이 두 번 붙는다).`,
    ``,
    `${BASE}${ad.landing}?offer=${ad.offer}&${UTM}`,
    ``,
    `소재 ${lines.length}개`,
    ...lines,
    ``,
    `규격을 지면에 맞춰 넣어라. 안 맞으면 메타가 잘라서 보여준다.`,
    `  1080x1350 (4:5)   피드. 세로 광고는 이걸 쓴다`,
    `  1080x1080 (1:1)   피드 · 탐색 탭`,
    `  1080x1920 (9:16)  스토리 · 릴스 전용`,
    `  1200x628          링크 · 오른쪽 칸`,
    ``,
    `9:16 을 피드에 올리면 "This image will be masked on Mobile News Feed"`,
    `가 뜬다. 링크 없는 이미지 광고의 피드 최대 세로비가 4:5 라서다.`,
    `그대로 두면 가운데만 남기고 잘려서 배지 · 헤드라인 · 버튼이 다 날아간다.`,
    ``,
    ad.adult ? `만 19세 이상 소재다. "심의위험-" 이 붙은 두 장은 배경이 밀착\n장면이라 성적 암시로 거부될 수 있다. 나머지 네 장으로 먼저 심사를\n통과시킨 뒤에 올려라.` : ``,
    ...(ad.note ?? []),
    ``,
  ].filter(Boolean).join("\r\n");

  await writeFile(path.join(dir, "읽어보기.txt"), readme, "utf8");
}

const index = "﻿" + [
  `LOVERABBIT 메타 업로드 소재`,
  ``,
  `광고별로 한 폴더씩이다. 폴더를 열고 jpg 를 통째로 끌어 올리면 된다.`,
  `각 폴더의 읽어보기.txt 에 랜딩 주소와 UTM 이 그대로 적혀 있다.`,
  ``,
  ...ads.map((a) => `  ${a.dir.padEnd(12)} ${a.sources.length}개   ${a.landing}`),
  ``,
  `이 폴더는 복사본이다. 원본은 hook-five-v1 / white-five-v1 /`,
  `shrine-square-v1 / card-square-v1 에 있고, 문구를 고치면 생성기를 다시 돌린 뒤`,
  `collect-meta-upload.mjs 를 다시 돌려야 여기에도 반영된다.`,
  ``,
  `게시 전에 확인할 것`,
  `  1. node scripts/verify-ad-offers.mjs https://loverebbit.xyz`,
  `  2. 새 계정으로 990원 결제를 끝까지 한 번 (기존 계정은 정가가 뜬다)`,
  `  3. Vercel OPENAI_API_KEY 유효한지`,
  ``,
].join("\r\n");

await writeFile(path.join(outDir, "읽어보기.txt"), index, "utf8");

// 링크만 모은 판. 메타 광고 만들기 화면의 "웹사이트 URL" 칸에 한 줄씩 붙여 넣는다.
// 폴더별 읽어보기.txt 에도 같은 주소가 있지만, 광고를 만들 때 폴더를 하나씩 여는
// 것보다 이 파일 하나를 띄워 두는 편이 빠르다. 같은 배열에서 뽑으므로 둘이
// 어긋날 수 없다.
const links = "﻿" + [
  `LOVERABBIT 메타 광고 링크 ${ads.length}개`,
  ``,
  `아래 주소를 "웹사이트 URL" 칸에 통째로 붙여 넣는다.`,
  `URL 매개변수 칸은 비운다 - 넣으면 UTM 이 두 번 붙는다.`,
  `{{campaign.name}} 과 {{ad.name}} 은 메타가 알아서 채운다. 그대로 둔다.`,
  ``,
  ...ads.flatMap((ad) => [
    `[${ad.dir}]  ${ad.product}`,
    `${BASE}${ad.landing}?offer=${ad.offer}&${UTM}`,
    ``,
  ]),
  `확인은 이렇게 한다`,
  `  node scripts/verify-ad-offers.mjs https://loverebbit.xyz`,
  ``,
].join("\r\n");

await writeFile(path.join(outDir, "광고링크.txt"), links, "utf8");

console.log(`Collected ${copied} files into ${ads.length} ad folders at marketing/ads/meta-upload-v1`);
if (missing.length) {
  console.log(`\n[!] 원본을 못 찾은 파일 ${missing.length}개:`);
  for (const m of missing) console.log(`    ${m}`);
  process.exitCode = 1;
}
