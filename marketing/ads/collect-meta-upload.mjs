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
const APP_CARDS = path.join("..", "..", "public", "cards-pastel");

const ads = [
  {
    dir: "01-이별",
    landing: "/product/ibyeol",
    offer: "breakup_decision_990",
    product: "이별 부검 리포트 29,900 -> 990",
    headline: "내가 뭘 그렇게 잘못했을까",
    sources: [
      [DARK, "05-breakup-ad-vertical-1080x1920.jpg"],
      [DARK, "05-breakup-ad-horizontal-1200x628.jpg"],
      [WHITE, "05-breakup-feed-1080x1350.jpg"],
      [WHITE, "05-breakup-story-1080x1920.jpg"],
      [SQUARE, "01-breakup-square-1080x1080.jpg"],
      [CARD, "01-breakup-square-1080x1080.jpg", "카드-"],
    ],
  },
  {
    dir: "02-궁합",
    landing: "/product/sokgunghap",
    offer: "compatibility_990",
    product: "속궁합 사주 9,900 -> 990",
    headline: "잘 맞다가도 꼭 여기서 틀어진다면",
    sources: [
      [DARK, "01-general-compatibility-ad-vertical-1080x1920.jpg"],
      [DARK, "01-general-compatibility-ad-horizontal-1200x628.jpg"],
      [WHITE, "01-compatibility-feed-1080x1350.jpg"],
      [WHITE, "01-compatibility-story-1080x1920.jpg"],
      [SQUARE, "02-compatibility-square-1080x1080.jpg"],
      [CARD, "02-compatibility-square-1080x1080.jpg", "카드-"],
    ],
  },
  {
    dir: "03-속궁합",
    landing: "/product/sokgunghap",
    offer: "intimate_compatibility_990",
    product: "속궁합 사주 9,900 -> 990",
    headline: "겉궁합은 좋은데 속궁합은 어떨까",
    sources: [
      [DARK, "02-intimate-compatibility-ad-vertical-1080x1920.jpg"],
      [DARK, "02-intimate-compatibility-ad-horizontal-1200x628.jpg"],
      [WHITE, "02-intimate-feed-1080x1350.jpg"],
      [WHITE, "02-intimate-story-1080x1920.jpg"],
      [SQUARE, "03-intimate-square-1080x1080.jpg"],
      [CARD, "03-intimate-square-1080x1080.jpg", "카드-"],
    ],
  },
  {
    dir: "04-연애운",
    landing: "/product/yeonae",
    offer: "yeonae_990",
    product: "올해의 연애운 14,900 -> 990",
    headline: "올해도 그냥 지나가는 걸까",
    sources: [
      [DARK, "04-romance-fortune-ad-vertical-1080x1920.jpg"],
      [DARK, "04-romance-fortune-ad-horizontal-1200x628.jpg"],
      [WHITE, "04-romance-timing-feed-1080x1350.jpg"],
      [WHITE, "04-romance-timing-story-1080x1920.jpg"],
      [SQUARE, "04-romance-timing-square-1080x1080.jpg"],
      [CARD, "04-romance-timing-square-1080x1080.jpg", "카드-"],
    ],
  },
  {
    dir: "05-19금",
    landing: "/product/sokgunghap",
    offer: "mature_compatibility_990",
    product: "속궁합 사주 9,900 -> 990",
    headline: "가까워질수록 어긋나는 느낌이라면",
    adult: true,
    // 어두운 소재는 배경이 밀착 장면이라 심의 위험이 가장 높다. 폴더에는 넣되
    // 이름 앞에 표시를 붙여 둔다 - 먼저 올릴 것과 구분되어야 한다.
    sources: [
      [WHITE, "03-mature-feed-1080x1350.jpg"],
      [WHITE, "03-mature-story-1080x1920.jpg"],
      [SQUARE, "06-mature-square-1080x1080.jpg"],
      [CARD, "06-mature-square-1080x1080.jpg", "카드-"],
      [DARK, "03-mature-night-ad-vertical-1080x1920.jpg", "심의위험-"],
      [DARK, "03-mature-night-ad-horizontal-1200x628.jpg", "심의위험-"],
    ],
  },
  {
    // 속마음(썸 해부)이 있던 자리다. 소재와 오퍼(inner_mind_990)는 코드에 그대로
    // 남아 있으니, 되돌리려면 이 항목만 예전 값으로 바꾸면 된다.
    dir: "06-바람기",
    landing: "/saju/baramgi",
    offer: "baramgi_990",
    product: "바람기 레이더 12,900 -> 990",
    headline: "그 사람, 믿어도 되는 걸까",
    // 이 주제는 스크린샷 세트에만 있다. 어두운 세트와 화이트 세트에는 없다.
    note: "1:1 두 장뿐이다(틀은 같고 배경만 다름). 어두운 세트와 화이트 세트에는 바람기 소재가 없다.",
    sources: [
      [SQUARE, "07-baramgi-square-1080x1080.jpg"],
      [CARD, "07-baramgi-square-1080x1080.jpg", "카드-"],
    ],
  },
  {
    dir: "07-도화",
    landing: "/product/dohwasal",
    offer: "dohwasal_990",
    product: "도화살 진단 9,900 -> 990",
    headline: "나한테 도화살, 진짜 있을까",
    note: "앱에서 실제로 쓰는 도화살 상품 카드 한 장이다.",
    sources: [
      [APP_CARDS, "dohwasal.jpg", "카드-"],
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
    ad.adult ? `만 19세 이상 소재다. "심의위험-" 이 붙은 두 장은 배경이 밀착\n장면이라 성적 암시로 거부될 수 있다. 나머지 네 장으로 먼저 심사를\n통과시킨 뒤에 올려라.` : ``,
    ad.note ?? ``,
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
// 폴더별 읽어보기.txt 에도 같은 주소가 있지만, 광고 일곱 개를 만들 때 폴더를
// 일곱 번 여는 것보다 이 파일 하나를 띄워 두는 편이 빠르다. 같은 배열에서 뽑으므로
// 둘이 어긋날 수 없다.
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
