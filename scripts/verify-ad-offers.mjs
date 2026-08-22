import puppeteer from "puppeteer-core";

// 광고 링크 다섯 개가 실제로 990원까지 이어지는지 확인한다.
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
  { name: "궁합", path: "/saju/compatibility", offer: "compatibility_990", category: "sokgunghap" },
  { name: "속궁합", path: "/saju/intimate-compatibility", offer: "intimate_compatibility_990", category: "sokgunghap" },
  { name: "연애운", path: "/saju/romance-timing", offer: "romance_timing_990", category: "insun" },
  { name: "이별", path: "/saju/breakup-decision", offer: "breakup_decision_990", category: "ibyeol" },
  { name: "19금", path: "/saju/mature-compatibility", offer: "mature_compatibility_990", category: "sokgunghap" },
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

  const url = BASE + link.path + "?" + UTM;
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
  check("CTA 가 오퍼를 달고 폼으로 간다", !!cta && cta.includes("c=" + link.category), String(cta));

  if (cta) {
    await page.goto(BASE + cta, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3000));
    const formBody = await page.evaluate(() => document.body.innerText);
    const prices = (formBody.match(/[\d,]+\s*원/g) ?? []).map((s) => s.replace(/[^\d]/g, ""));
    check("폼이 990원으로 받는다", prices.includes("990"), prices.slice(0, 5).join(" / ") || "값 없음");
    // 정가가 같이 보이는 것은 정상(할인 표시). 정가만 있고 990 이 없으면 실패다.
  }

  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
