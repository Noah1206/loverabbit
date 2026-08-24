import puppeteer from "puppeteer-core";

// 지금 켜는 광고 링크가 990원까지 이어지는지 확인한다.
//
// 확인하는 것은 셋이다.
//   1. 랜딩이 열리고 990원을 말하는가
//   2. CTA 가 offer 를 달고 입력 폼으로 넘기는가
//   3. 폼이 그 오퍼를 990원으로 받아 화면에 띄우는가
//
// AI 는 부르지 않는다. 리딩을 만드는 데까지 가지 않고, 값이 붙는 지점까지만 본다.

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = process.argv[2] ?? "http://localhost:3000";
const UTM = "utm_source=meta&utm_medium=paid&utm_campaign=TEST_CAMPAIGN&utm_content=TEST_AD";

const LINKS = [
  // 켜는 광고 넷 - marketing/ads/collect-meta-upload.mjs 의 배열과 같다
  // (연애운은 새 주소와 예전 랜딩 둘 다 보므로 줄이 다섯이다).
  // 안 켜는 오퍼(궁합·19금·속마음·도화·바람기)도 코드에는 살아 있고,
  // 맨 주소로 값이 새는지는 아래 BARE 가 전부 훑는다.
  { name: "속궁합", path: "/saju/intimate-compatibility", offer: "intimate_compatibility_990", category: "sokgunghap" },
  // 인연 타이밍이 올해의 연애운으로 합쳐지면서(2026-08-24) 새 광고는 상품 주소를
  // 쓴다. 예전 랜딩도 같은 상품을 990원에 그대로 팔고, 이미 게시된 광고가 그
  // 주소를 들고 있으므로 둘 다 센다. 한쪽만 보면 나머지 한쪽이 조용히 죽는다.
  { name: "연애운", path: "/product/yeonae", offer: "yeonae_990", category: "yeonae" },
  { name: "연애운(구 랜딩)", path: "/saju/romance-timing", offer: "romance_timing_990", category: "yeonae" },
  { name: "이별", path: "/saju/breakup-decision", offer: "breakup_decision_990", category: "ibyeol" },
  { name: "재회", path: "/product/jaehoe", offer: "jaehoe_990", category: "jaehoe" },
];

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`  ${pass ? "[PASS]" : "[FAIL]"} ${name}${detail ? " - " + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});

for (const link of LINKS) {
  console.log(`\n[${link.name}] ${link.path}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("loverabbit-consent-v1", "denied"));

  const url = BASE + link.path + "?offer=" + encodeURIComponent(link.offer) + "&" + UTM;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));

  check("랜딩이 열린다", response?.status() === 200, String(response?.status()));

  const body = await page.evaluate(() => document.body.innerText);
  check("랜딩에 990원이 보인다", /990\s*원/.test(body), (body.match(/[\d,]+\s*원/g) ?? []).slice(0, 4).join(" / "));

  const marker = await page.evaluate(() => document.querySelector("[data-offer]")?.getAttribute("data-offer"));
  check("오퍼 id 가 박혀 있다", marker === link.offer, String(marker));

  // UTM 이 살아 있어야 광고 성과가 붙는다
  const utmKept = await page.evaluate(() => {
    try {
      return JSON.stringify(JSON.parse(localStorage.getItem("lr-attr") ?? "null"));
    } catch {
      return null;
    }
  });
  check("UTM 이 기록된다", !!utmKept && utmKept.includes("meta"), (utmKept ?? "없음").slice(0, 90));

  // CTA 로 폼까지
  const cta = await page.evaluate((expected) => {
    const a = [...document.querySelectorAll("a")].find((n) => (n.getAttribute("href") ?? "").includes("offer=" + expected));
    return a?.getAttribute("href") ?? null;
  }, link.offer);
  const target = cta;
  check(
    "CTA 가 오퍼를 달고 폼으로 간다",
    !!target && target.includes("c=" + link.category) && target.includes("offer=" + link.offer),
    String(target)
  );

  if (target) {
    await page.goto(BASE + target, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3000));
    // 폼에서는 값을 안 센다.
    //
    // 값이 나오는 자리는 입력이 다 끝난 뒤의 결과 화면이다 (잠금 버튼의
    // "990원으로 끝까지 운명보기"). 입력 도중에 미리 말하지 않는다 - 아직 아무것도
    // 못 받은 사람에게 값부터 꺼내면 거기서 나간다.
    //
    // 그래서 여기서 볼 것은 값이 아니라 **오퍼가 폼까지 살아서 왔는가** 다.
    // 이게 끊기면 결과 화면이 정가로 계산한다.
    const kept = await page.evaluate(() => window.location.search);
    check(
      "오퍼가 폼까지 살아 있다",
      kept.includes("offer=" + link.offer) && kept.includes("c=" + link.category),
      kept || "(빈 쿼리)"
    );
  }

  await page.close();
}

// offer id는 공개값이므로 상품과의 조합을 서버에서 반드시 검증해야 한다.
console.log(`\n[오퍼 위조 방지] /product/yeonae + breakup_decision_990`);
{
  const page = await browser.newPage();
  await page.goto(BASE + "/product/yeonae?offer=breakup_decision_990", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  const state = await page.evaluate(() => ({
    marker: document.querySelector("[data-product]")?.getAttribute("data-offer") ?? null,
    cta: [...document.querySelectorAll("a")]
      .map((node) => node.getAttribute("href"))
      .find((href) => href?.startsWith("/reading?c=yeonae")) ?? null,
  }));
  check("다른 상품용 오퍼는 무시한다", state.marker === null, String(state.marker));
  check("정가 CTA에 잘못된 오퍼를 넘기지 않는다", !!state.cta && !state.cta.includes("offer="), String(state.cta));
  await page.close();
}

// 990원은 광고 링크로 들어왔을 때만이다.
//
// 전용 랜딩(/saju/*)은 예전에 주소를 안 보고 늘 990원을 말했다. 그냥 열기만 해도
// CTA 에 offer 가 실려 나갔고, 서버는 그 offer 를 받아 리딩 값을 990원으로 박았다.
// 광고를 한 번도 안 거친 사람이 정가짜리를 990원에 사고 있었다는 뜻이다.
//
// 값이 새는 것은 화면만 봐서는 안 보인다. 여기서 오퍼 없는 맨 주소를 열고,
// CTA 가 offer 를 안 달고 나가는지 본다.
const BARE = [
  { name: "궁합", path: "/saju/compatibility", category: "sokgunghap", list: "9,900" },
  { name: "속궁합", path: "/saju/intimate-compatibility", category: "sokgunghap", list: "9,900" },
  { name: "19금", path: "/saju/mature-compatibility", category: "sokgunghap", list: "9,900" },
  { name: "인연", path: "/saju/romance-timing", category: "yeonae", list: "14,900" },
  { name: "연애운", path: "/product/yeonae", category: "yeonae", list: "14,900" },
  { name: "재회", path: "/product/jaehoe", category: "jaehoe", list: "14,900" },
  { name: "이별", path: "/saju/breakup-decision", category: "ibyeol", list: "29,900" },
  { name: "속마음", path: "/saju/inner-mind", category: "sseom", list: "12,900" },
  { name: "도화", path: "/saju/dohwasal", category: "dohwasal", list: "9,900" },
  { name: "바람기", path: "/saju/baramgi", category: "baramgi", list: "12,900" },
];

console.log(`\n[광고 링크 없이 들어오면 정가]`);
for (const bare of BARE) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("loverabbit-consent-v1", "denied"));
  await page.goto(BASE + bare.path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));

  const state = await page.evaluate((category) => ({
    body: document.body.innerText,
    marker: document.querySelector("[data-offer]")?.getAttribute("data-offer") ?? null,
    ctas: [...document.querySelectorAll("a")]
      .map((node) => node.getAttribute("href") ?? "")
      .filter((href) => href.includes(`/reading?c=${category}`)),
  }), bare.category);

  // 가장 중요한 줄이다. 여기가 새면 값이 샌다.
  check(
    `${bare.name} - 맨 주소 CTA 에 오퍼가 없다`,
    state.ctas.every((href) => !href.includes("offer=")),
    state.ctas.join(" ") || "(리딩 링크 없음)"
  );
  check(`${bare.name} - 맨 주소에 오퍼 표시가 없다`, state.marker === null, String(state.marker));
  check(`${bare.name} - 990원을 말하지 않는다`, !/990\s*원/.test(state.body), (state.body.match(/[\d,]+\s*원/g) ?? []).slice(0, 3).join(" / "));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
