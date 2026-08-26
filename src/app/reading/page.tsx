"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { resolveAdOffer } from "@/lib/ad-offers";
import { useRouter } from "next/navigation";
import {
  emptyPerson,
  peekReadingDraft,
  saveReadingDraft,
  type PersonForm,
  type ReadingDraft,
} from "@/lib/reading-draft";
import { getUser, type User } from "@/lib/user";
import { hasLeapMonth, lunarToSolar } from "@/lib/lunar";
import { computeSaju } from "@/lib/saju";
import SajuChart from "@/components/SajuChart";
import {
  captureReferralFromLocation,
  type PendingReferral,
} from "@/lib/referral";
import {
  landingTypeForProduct,
  trackSajuFormCompleted,
  trackSajuFormStarted,
} from "@/lib/meta-events";
import { trackFunnel } from "@/lib/funnel";
import SignupModal from "@/components/SignupModal";
import { PAY_BEFORE_GENERATE } from "@/lib/reading-gate";
import type { ReadingStepName } from "@/lib/funnel-events";

// 카테고리 목록은 상품 카탈로그에서 파생한다 (상품 추가 시 여기 손댈 필요 없음)
const CATEGORIES = PRODUCTS.map((p) => ({
  id: p.id,
  label: p.shortLabel,
  needsPartner: p.needsPartner,
}));

type CategorySelectionMode = "loading" | "fixed" | "picker";
// 순서가 바뀌었다 (2026-08-22, 운영자 결정): 사주 선택이 맨 앞이 아니라 맨 뒤다.
// 자기 정보와 고민을 먼저 적고, 마지막에 그에 맞는 리딩을 고른다. 상대 정보가
// 필요한지는 상품이 정하는데 상품을 아직 안 골랐으므로, 혼자 볼지 함께 볼지를
// 먼저 묻는 mode 단계가 그 자리를 대신한다.
// 단계 이름은 통계와 공유한다. 여기서만 정의하면 화면이 칸을 하나 늘렸을 때
// 퍼널이 조용히 그 칸을 모르는 상태가 된다 — 그러면 그 칸의 이탈이 안 보인다.
type ReadingStep = ReadingStepName;

const READING_STEP_LABELS: Record<ReadingStep, string> = {
  category: "리딩 선택",
  mode: "함께 볼 사람",
  meGender: "성별",
  meBirth: "내 생년월일",
  meDetails: "내 출생 정보",
  partnerChoice: "그 사람 사주",
  partnerBirth: "그 사람 생년월일",
  partnerDetails: "그 사람 출생 정보",
  concern: "지금의 고민",
  ready: "마지막 확인",
};

// 생년월일 유효성 검사 — 서버에서도 한 번 더 검증하지만, 여기서 먼저 친절하게 막는다
/** 음력으로 입력했으면 양력으로 바꾼 날짜. 양력이면 그대로. 없는 날짜면 null. */
function solarOf(p: PersonForm): { year: number; month: number; day: number } | null {
  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (p.calendar !== "lunar") return { year, month, day };
  return lunarToSolar({ year, month, day, leapMonth: p.leapMonth === true })?.solar ?? null;
}

function birthError(p: PersonForm, who: string, requireAdult = false): string | null {
  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  const lunar = p.calendar === "lunar";
  const nowYear = new Date().getFullYear();
  if (isNaN(year) || year < 1900 || year > nowYear) return `${who} 출생연도를 확인해주세요 (1900~${nowYear}).`;
  // "내 일은" 은 "내일은" 으로 읽힌다. 달·날은 "태어난" 을 붙여 떼어 놓는다.
  if (isNaN(month) || month < 1 || month > 12) return `${who} 태어난 달은 1~12 사이여야 해요.`;
  if (isNaN(day) || day < 1 || day > (lunar ? 30 : 31)) {
    return `${who} 태어난 날은 1~${lunar ? 30 : 31} 사이여야 해요.`;
  }
  // 음력은 양력 달력으로 검사하면 안 된다. 변환이 되는지로 존재 여부를 판단한다.
  const solar = solarOf(p);
  if (!solar) {
    return lunar
      ? `${who} 음력 ${month}월 ${day}일은 없는 날짜예요. 윤달 여부를 확인해주세요.`
      : `${who} ${month}월 ${day}일은 없는 날짜예요.`;
  }
  const d = new Date(solar.year, solar.month - 1, solar.day);
  if (!lunar && (d.getMonth() !== month - 1 || d.getDate() !== day)) {
    return `${who} ${month}월 ${day}일은 없는 날짜예요.`;
  }
  if (d.getTime() > Date.now()) return `${who} 생일이 미래일 수는 없어요.`;
  if (requireAdult) {
    const today = new Date();
    const cutoff = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate());
    if (d.getTime() > cutoff.getTime()) return "만 19세 이상만 이용할 수 있어요.";
  }
  return null;
}

function personSummary(person: PersonForm): string {
  const birthTime = !person.hour || person.hour === "unknown" ? "태어난 시간 모름" : `${person.hour}시 출생`;
  const gender = person.gender === "M" ? "남성" : person.gender === "F" ? "여성" : "성별 미선택";
  let date = `${person.year}.${person.month}.${person.day}`;
  if (person.calendar === "lunar") {
    // 음력으로 받았으면 실제로 무엇으로 계산되는지 함께 보여준다
    const solar = solarOf(person);
    const leap = person.leapMonth ? " 윤달" : "";
    date = solar
      ? `음력 ${date}${leap} (양력 ${solar.year}.${solar.month}.${solar.day})`
      : `음력 ${date}${leap}`;
  }
  return `${date} · ${birthTime} · ${gender}`;
}

function hasValidBirth(person: PersonForm, requireAdult = false): boolean {
  return Boolean(person.year && person.month && person.day && !birthError(person, "", requireAdult));
}

function hasValidDetails(person: PersonForm): boolean {
  const hour = person.hour === "unknown"
    || (/^\d{1,2}$/.test(person.hour) && Number(person.hour) >= 0 && Number(person.hour) <= 23);
  return hour && (person.gender === "F" || person.gender === "M");
}

// 공유 이미지 생성 — 인스타 스토리·릴스 캡처용 (ROADMAP Week 2 바이럴 루프의 엔진)
function downloadShareImage(teaser: string) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#121215");
  bg.addColorStop(1, "#0a0a0c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#26262c";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f2f4";
  ctx.font = "bold 56px 'Malgun Gothic', sans-serif";
  ctx.fillText("🐰 러브레빗", W / 2, 180);
  ctx.fillStyle = "#a5a3ac";
  ctx.font = "32px 'Malgun Gothic', sans-serif";
  ctx.fillText("레빗 언니가 나한테 한 말", W / 2, 240);

  // 티저 본문 워드랩
  ctx.fillStyle = "#efe9f5";
  ctx.font = "40px 'Malgun Gothic', sans-serif";
  const maxWidth = W - 200;
  const words = teaser.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const lineHeight = 62;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight));

  // 따옴표 장식
  ctx.fillStyle = "#8b5cf6";
  ctx.font = "bold 120px Georgia, serif";
  ctx.fillText("“", 140, startY - 80);

  ctx.fillStyle = "#e8b84b";
  ctx.font = "bold 36px 'Malgun Gothic', sans-serif";
  ctx.fillText("너도 궁금하면 → 러브레빗", W / 2, H - 160);
  ctx.fillStyle = "#a5a3ac";
  ctx.font = "28px 'Malgun Gothic', sans-serif";
  ctx.fillText("속궁합·연애운을 섬세하게 읽는 AI 사주", W / 2, H - 110);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "loverabbit-reading.png";
  a.click();
}

// 양력·음력 선택. 음력이면 그 달에 윤달이 실제로 있을 때만 체크박스를 열고,
// 어떤 양력 날짜로 계산되는지 그 자리에서 보여준다.
function CalendarToggle({
  value,
  onChange,
}: {
  value: PersonForm;
  onChange: (v: PersonForm) => void;
}) {
  const lunar = value.calendar === "lunar";
  const year = parseInt(value.year, 10);
  const month = parseInt(value.month, 10);
  const monthKnown = !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12;
  const leapAvailable = lunar && monthKnown && hasLeapMonth(year, month);
  const converted = lunar ? solarOf(value) : null;

  const pick = (next: "solar" | "lunar") =>
    onChange({ ...value, calendar: next, leapMonth: next === "lunar" && value.leapMonth === true });

  return (
    <div className="reading-calendar">
      <div className="reading-calendar-toggle" role="group" aria-label="달력 종류">
        <button type="button" className={lunar ? "" : "on"} onClick={() => pick("solar")}>
          양력
        </button>
        <button type="button" className={lunar ? "on" : ""} onClick={() => pick("lunar")}>
          음력
        </button>
      </div>

      {lunar && (
        <div className="reading-calendar-lunar">
          <label className={leapAvailable ? "" : "off"}>
            <input
              type="checkbox"
              checked={leapAvailable && value.leapMonth === true}
              disabled={!leapAvailable}
              onChange={(e) => onChange({ ...value, leapMonth: e.target.checked })}
            />
            윤달이에요
          </label>
          {monthKnown && !leapAvailable && <small>{month}월에는 윤달이 없어요</small>}
          {converted && (
            <small className="on">
              양력 {converted.year}.{converted.month}.{converted.day}로 계산돼요
            </small>
          )}
        </div>
      )}
    </div>
  );
}

function BirthDateFields({
  value,
  onChange,
}: {
  value: PersonForm;
  onChange: (v: PersonForm) => void;
}) {
  const set = (k: keyof PersonForm, v: string) => onChange({ ...value, [k]: v });

  // 숫자만 받는다. 칸 사이 포커스는 옮기지 않는다 (2026-08-25 운영자 요청) -
  // 손가락 아래에서 커서가 옮겨 가면 치던 숫자가 옆 칸에 들어간다.
  const setDigits = (key: "year" | "month" | "day", raw: string, maxLen: number) => {
    set(key, raw.replace(/\D/g, "").slice(0, maxLen));
  };

  return (
    <div className="reading-birth-grid">
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-year">연도</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-year"
            placeholder="1995"
            inputMode="numeric"
            autoComplete="bday-year"
            maxLength={4}
            value={value.year}
            onChange={(e) => setDigits("year", e.target.value, 4)}
          />
          <span aria-hidden="true">년</span>
        </div>
      </div>
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-month">월</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-month"
            placeholder="07"
            inputMode="numeric"
            autoComplete="bday-month"
            maxLength={2}
            value={value.month}
            onChange={(e) => setDigits("month", e.target.value, 2)}
          />
          <span aria-hidden="true">월</span>
        </div>
      </div>
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-day">일</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-day"
            placeholder="14"
            inputMode="numeric"
            autoComplete="bday-day"
            maxLength={2}
            value={value.day}
            onChange={(e) => setDigits("day", e.target.value, 2)}
          />
          <span aria-hidden="true">일</span>
        </div>
      </div>
    </div>
  );
}

// showGender=false 는 내 정보 단계에서 쓴다. 내 성별은 맨 앞에서 이미 받았고,
// 같은 질문을 두 번 하면 고쳐야 하는 값인지 헷갈린다. 상대 정보는 앞 단계가
// 없으니 여기서 같이 받는다.
function PersonDetailsFields({
  value,
  onChange,
  showGender = true,
}: {
  value: PersonForm;
  onChange: (v: PersonForm) => void;
  showGender?: boolean;
}) {
  const set = (key: "hour" | "gender", nextValue: string) => onChange({ ...value, [key]: nextValue });

  return (
    <div className="reading-details-grid">
      <div>
        <label htmlFor="reading-birth-hour">태어난 시간</label>
        <select id="reading-birth-hour" value={value.hour} onChange={(e) => set("hour", e.target.value)}>
          <option value="" disabled>선택해주세요</option>
          <option value="unknown">모름</option>
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>{hour}시</option>
          ))}
        </select>
      </div>
      {showGender && (
        <div>
          <label htmlFor="reading-gender">성별</label>
          <select id="reading-gender" value={value.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="" disabled>선택해주세요</option>
            <option value="F">여성</option>
            <option value="M">남성</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default function ReadingPage() {
  const router = useRouter();
  const [category, setCategory] = useState("sokgunghap");
  const [offerId, setOfferId] = useState<string | undefined>();
  const [categorySelectionMode, setCategorySelectionMode] = useState<CategorySelectionMode>("loading");
  const [step, setStep] = useState<ReadingStep>("category");
  // 화면이 어느 쪽에서 들어올지. 다음으로 가면 오른쪽에서, 뒤로 가면 왼쪽에서.
  // 방향이 없으면 뒤로 가는데도 앞으로 가는 것처럼 보여 어디로 움직였는지 잃는다.
  const [stepDir, setStepDir] = useState<"forward" | "back">("forward");
  const [hasChosenCategory, setHasChosenCategory] = useState(false);
  // 혼자/함께 를 골랐는가. withPartner 의 기본값(true)과 "골랐다"는 별개라 따로 든다.
  const [modeChosen, setModeChosen] = useState(false);
  // 상대 사주를 넣을지 이 화면에서 골랐는가. 같은 이유로 withPartner 와 따로 든다.
  const [partnerChosen, setPartnerChosen] = useState(false);
  const [me, setMe] = useState<PersonForm>(emptyPerson);
  const [partner, setPartner] = useState<PersonForm>(emptyPerson);
  const [withPartner, setWithPartner] = useState(true);
  // 지금 가장 답답한 것 한 줄 — 선택 입력이지만, 있으면 리포트가 이 장면에 답한다
  const [question, setQuestion] = useState("");
  const [occupation, setOccupation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  // 로그인하고 나면 그대로 이어 보낼 입력. 누른 순간의 값을 들고 간다.
  const [pendingDraft, setPendingDraft] = useState<ReadingDraft | null>(null);
  const [pendingReferral, setPendingReferral] = useState<PendingReferral | null>(null);

  // 첫 설문 입력 — 생년월일 칸에 처음 값이 들어간 순간 한 번만 보낸다.
  const formStartedRef = useRef(false);
  useEffect(() => {
    if (formStartedRef.current) return;
    if (!me.year && !me.month && !me.day) return;
    const landing = landingTypeForProduct(category, offerId);
    if (!landing) return;
    formStartedRef.current = true;
    trackSajuFormStarted(landing);
  }, [me, category, offerId]);

  /*
    어느 칸에서 손을 놓는가.

    폼이 아홉 칸이고 그 사이의 이탈이 지금껏 하나도 안 보였다. 리딩이 만들어진
    것만 남으니, 폼을 열었다 닫은 사람은 통계에 아예 존재하지 않았다.

    칸이 바뀔 때마다 한 줄 남기고, 앞 칸에 머문 시간을 함께 적는다. 세션의
    마지막 step_view 가 그 사람이 포기한 칸이다. 값은 보내지 않는다 — 칸의
    이름만 간다.
  */
  const lastStep = useRef<ReadingStep | null>(null);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    // 머문 시간은 싣지 않는다. 칸을 넘어올 때 잴 수 있는 것은 "직전 칸에 있던
    // 시간" 인데 이 줄이 이름표로 달고 가는 것은 새 칸이라, 두 값을 한 줄에
    // 담으면 읽는 사람이 반드시 엉뚱한 칸의 시간으로 읽는다. 화면 단위 체류는
    // page_exit 이 제대로 센다.
    trackFunnel("step_view", {
      step,
      product: category || undefined,
      landing: landingTypeForProduct(category, offerId) ?? undefined,
    });
  }, [step, category, offerId]);

  // 생성은 이 화면에서 하지 않는다. 초안만 남기고 대기 화면으로 넘겨, 18초의 기다림이
  // 폼이 아니라 결과 쪽에서 일어나게 한다.
  const startGeneration = useCallback(
    (draft: ReadingDraft) => {
      setLoading(true);
      setError("");
      saveReadingDraft(draft);
      const landing = landingTypeForProduct(draft.category, draft.offerId);
      if (landing) trackSajuFormCompleted(landing);
      trackFunnel("preview_requested", {
        product: draft.category,
        landing: landing ?? undefined,
      });
      router.push("/reading/generating");
    },
    [router],
  );

  // 홈 상품 카드나 광고에서 ?c= 로 진입해도 리딩 선택 화면을 먼저 보여준다.
  // 해당 상품은 미리 선택만 해두고, 사용자가 '다음으로'를 눌러야 생년월일 입력으로 이동한다.
  // 로그인 복귀 시 저장된 입력값이 있으면 기존 흐름을 자동 재개한다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    const found = CATEGORIES.find((x) => x.id === c);
    const offer = found ? resolveAdOffer(found.id, params.get("offer")) : null;
    if (found) {
      setCategory(found.id);
      setWithPartner(found.needsPartner);
    }
    setOfferId(offer?.id);
    // 광고·홈 카드로 들어와 상품이 정해져 있으면(found) 선택·mode 단계를 아예
    // 건너뛴다 — fixed 흐름. 아니면 picker 흐름으로 맨 뒤에서 고른다.
    setCategorySelectionMode(found ? "fixed" : "picker");
    setStep("meGender");
    setHasChosenCategory(Boolean(found));
    setModeChosen(Boolean(found));

    const stored = getUser();
    setUser(stored);
    // 초안은 대기 화면이 소비한다. 여기서는 값만 복원하고 그대로 넘긴다.
    const draft = peekReadingDraft();
    if (draft) {
      setCategory(draft.category);
      setOfferId(draft.offerId);
      setMe(draft.me);
      setPartner(draft.partner);
      setWithPartner(draft.withPartner);
      setQuestion(draft.question ?? "");
      setOccupation(draft.occupation ?? "");
      setCategorySelectionMode("fixed");
      setHasChosenCategory(true);
      setModeChosen(true);
      // 자동 재개는 로그인 복귀 초안만. 생성 화면이 뒤로가기 대비로 되돌려 둔
      // 초안(autoResume: false)까지 자동으로 다시 돌리면, 뒤로가기가 곧 재제출이
      // 되어 생성 화면과 폼이 서로를 계속 부른다. 값만 복원하고 확인 화면에 세운다.
      if (stored && draft.autoResume !== false) {
        startGeneration(draft);
      } else {
        setStep("ready");
      }
    }
    setPendingReferral(captureReferralFromLocation());
  }, [startGeneration]);

  const validateForm = (): string | null => {
    if (!me.year || !me.month || !me.day) {
      return "본인 생년월일을 입력해주세요.";
    }
    const myErr = birthError(me, "내", true);
    if (myErr) return myErr;
    if (withPartner && (!partner.year || !partner.month || !partner.day)) {
      return "그 사람의 생년월일을 입력해주세요.";
    }
    if (withPartner) {
      const pErr = birthError(partner, "그 사람");
      if (pErr) return pErr;
    }
    return null;
  };

  const submit = () => {
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    const draft: ReadingDraft = {
      category,
      offerId,
      me,
      partner,
      withPartner,
      question: question.trim(),
      occupation: occupation.trim(),
      createdAt: Date.now(),
    };
    /*
      로그인 관문이 다시 여기로 왔다 (2026-08-26).

      8/25 에 이 자리의 가입 팝업을 없앤 이유는 폼을 다 채운 사람 4명 중 3명이
      여기서 나갔기 때문이다. 그때는 뒤에 오는 것이 무료 글이었으니, 관문을
      미룰수록 이득이었다.

      지금은 뒤에 오는 것이 주문이다 (reading-gate.ts). 사흘 동안 리딩 115건을
      만들어 4건을 팔았고 AI 값이 매출을 넘었다. 안 사는 사람의 글을 먼저 만드는
      구조에서는 트래픽이 늘수록 손해가 커진다. 주인 없는 주문은 만들 수도 없다.
    */
    if (PAY_BEFORE_GENERATE && !user) {
      setPendingDraft(draft);
      trackFunnel("signup_required", { product: draft.category });
      return;
    }
    startGeneration(draft);
  };

  // 확인 화면에 보여줄 내 명식. 서버가 리딩을 만들 때 쓰는 것과 같은 계산이다.
  // 값이 아직 안 채워졌거나 없는 날짜면 null이 되어 표를 그리지 않는다.
  const meChart = useMemo(() => {
    if (step !== "ready") return null;
    const solar = solarOf(me);
    if (!solar) return null;
    try {
      return computeSaju({
        year: solar.year,
        month: solar.month,
        day: solar.day,
        hour: !me.hour || me.hour === "unknown" ? null : parseInt(me.hour, 10),
      });
    } catch {
      return null;
    }
  }, [step, me]);

  const selectedCategory = CATEGORIES.find((item) => item.id === category);

  /*
    두 사람을 보는 상품이면 상대 입력을 되돌려 놓는다.

    체크박스를 감추는 것만으로는 모자라다. 저장해 둔 초안을 복원할 때
    (setWithPartner(draft.withPartner)) 예전에 꺼 둔 값이 그대로 살아나고,
    그러면 화면에는 선택지가 없는데 상태는 "상대 없음" 인 채로 제출된다.
  */
  useEffect(() => {
    // 고르기 전에는 건드리지 않는다 — category 의 초기값이 우연히 커플 상품이라,
    // 이 효과가 마운트에서 돌면 mode 단계에서 고른 "혼자"가 덮인다.
    if (hasChosenCategory && selectedCategory?.needsPartner) setWithPartner(true);
  }, [hasChosenCategory, selectedCategory?.needsPartner]);
  /*
    이 화면에서 "넣을지 말지" 를 고를 수 있는가.

    두 사람을 보는 상품에서는 고를 수 없다. 상대를 안 넣으면 12절 중 못 채우는
    절이 1%에서 70%로 뛴다 — 리포트는 그래도 나오지만 상대 이야기가 본인 이야기의
    되풀이가 되고, 그 값을 치른 사람은 두 사람을 보러 온 사람이다. 그 상품에서
    이 화면은 "이제 그 사람 차례" 를 알리는 자리로만 선다.

    앞의 mode 단계에서 혼자/함께를 이미 고른 흐름도 마찬가지다. 같은 질문을 두 번
    하면 앞에서 고른 것이 무효가 된 줄 안다.
  */
  const partnerChoiceIsOpen =
    categorySelectionMode === "fixed" && !selectedCategory?.needsPartner;

  const activeOffer = resolveAdOffer(category, offerId);


  const moveTo = (nextStep: ReadingStep) => {
    setError("");
    setStepDir("forward");
    setStep(nextStep);
  };

  const showBirthError = (person: PersonForm, who: string, requireAdult = false): boolean => {
    if (!person.year || !person.month || !person.day) {
      setError(`${who} 생년월일을 입력해주세요.`);
      return true;
    }
    const nextError = birthError(person, who, requireAdult);
    if (nextError) {
      setError(nextError);
      return true;
    }
    return false;
  };

  const confirmCategory = () => {
    if (!hasChosenCategory) return;
    // fixed 로 바꾸지 않는다 — fixed 는 "입구에서 상품이 정해져 온" 흐름의 표시다.
    // 여기서 바꾸면 뒤로가기에서 선택 단계가 사라진다.
    moveTo("ready");
    const params = new URLSearchParams(window.location.search);
    params.set("c", category);
    if (activeOffer) {
      params.set("offer", activeOffer.id);
    } else {
      params.delete("offer");
    }
    router.replace(`/reading?${params.toString()}`, { scroll: false });
  };

  const advanceStep = () => {
    if (step === "meGender") {
      moveTo("meBirth");
      return;
    }
    if (step === "meBirth") {
      if (!showBirthError(me, "내", true)) moveTo("meDetails");
      return;
    }
    if (step === "meDetails") {
      // 입구에서 상품이 정해진 흐름은 상품이 상대 필요 여부를 이미 정했다.
      // 고르는 흐름은 mode 단계가 그걸 묻는다. 어느 쪽이든 상대 입력 앞에는
      // partnerChoice 가 한 칸 선다 — 내 정보 다음에 곧바로 남의 생년월일 칸이
      // 나오면 무엇을 적는 자리인지 모른 채 적게 된다.
      moveTo(categorySelectionMode === "fixed" ? "partnerChoice" : "mode");
      return;
    }
    if (step === "mode") {
      moveTo(withPartner ? "partnerChoice" : "concern");
      return;
    }
    if (step === "partnerChoice") {
      moveTo(withPartner ? "partnerBirth" : "concern");
      return;
    }
    if (step === "partnerBirth") {
      if (!showBirthError(partner, "그 사람")) moveTo("partnerDetails");
      return;
    }
    if (step === "partnerDetails") {
      moveTo("concern");
      return;
    }
    if (step === "concern") {
      moveTo(categorySelectionMode === "fixed" ? "ready" : "category");
      return;
    }
    if (step === "category") {
      confirmCategory();
      return;
    }
    submit();
  };

  const workflowSteps: readonly ReadingStep[] =
    categorySelectionMode === "fixed"
      ? withPartner
        ? ["meGender", "meBirth", "meDetails", "partnerChoice", "partnerBirth", "partnerDetails", "concern", "ready"]
        // 안 넣기로 해도 partnerChoice 는 지나온 칸이다. 빼면 뒤로가기가 그 화면을
        // 건너뛰어, 방금 고른 것을 되돌릴 길이 없어진다.
        : ["meGender", "meBirth", "meDetails", "partnerChoice", "concern", "ready"]
      : withPartner
        ? ["meGender", "meBirth", "meDetails", "mode", "partnerChoice", "partnerBirth", "partnerDetails", "concern", "category", "ready"]
        : ["meGender", "meBirth", "meDetails", "mode", "concern", "category", "ready"];
  const workflowStepIndex = Math.max(0, workflowSteps.indexOf(step));

  // 헤더의 < 버튼. 첫 단계에서는 흐름을 벗어나 홈으로 돌아간다.
  const goBack = () => {
    setError("");
    if (workflowStepIndex <= 0) {
      router.push("/");
      return;
    }
    setStepDir("back");
    setStep(workflowSteps[workflowStepIndex - 1]);
  };

  const showFixedAction = categorySelectionMode !== "loading" && (step !== "category" || hasChosenCategory);
  // 고민 단계도 머리글을 띄운다. 다른 입력 단계와 달리 무엇을 왜 적는지가
  // 컨트롤만 봐서는 드러나지 않는 자리다.
  const showIntroHeader =
    categorySelectionMode === "loading" ||
    step === "meGender" ||
    step === "meBirth" ||
    step === "category" ||
    step === "partnerChoice" ||
    step === "concern";
  const isDataEntryStep = step === "meGender"
    || step === "meBirth"
    || step === "meDetails"
    || step === "partnerBirth"
    || step === "partnerDetails"
    || step === "concern";
  const isStepComplete = step === "category"
    ? hasChosenCategory
    : step === "partnerChoice"
    // 고를 수 없는 자리면 읽고 넘어가는 화면이다. 고를 수 있으면 골라야 넘어간다.
    ? !partnerChoiceIsOpen || partnerChosen
    : step === "mode"
    ? modeChosen
    : step === "meGender"
    ? me.gender === "F" || me.gender === "M"
    : step === "meBirth"
      ? hasValidBirth(me, true)
      : step === "meDetails"
        ? hasValidDetails(me)
        : step === "partnerBirth"
          ? hasValidBirth(partner)
          : step === "partnerDetails"
            ? hasValidDetails(partner)
            : step === "concern"
              ? true
              : validateForm() === null;

  const visibleMeBirthError = step === "meBirth" && me.year && me.month && me.day
    ? birthError(me, "내", true)
    : null;


  return (
    <main className="container reading-flow-page">
      {/* 이 흐름 전용 상단바. 홈의 .app-header와 달리 뒤로 가기 하나만 둔다 —
          입력 중에 QR이나 로그인으로 새는 길을 만들지 않기 위해서다. */}
      <header className="reading-flow-topbar">
        <button type="button" onClick={goBack} aria-label={workflowStepIndex <= 0 ? "홈으로" : "이전 단계로"}>
          <span aria-hidden>‹</span>
          러브레빗
        </button>
      </header>

      {/* 머리글과 아래 고정 버튼은 같은 부모의 형제다. 둘 다 key={step} 이면 React 가
          형제를 key 로 맞춰 볼 때 한쪽이 다른 쪽을 덮어써서, 단계가 바뀔 때마다 옛
          머리글이 지워지지 않고 쌓였다 (2026-08-25, 상대 정보 화면에 "당신의 사주부터"
          가 남아 있던 원인). 형제끼리는 key 가 달라야 한다. */}
      {showIntroHeader && (
        <header key={"header-" + step} className="reading-flow-header" data-dir={stepDir}>
          {step === "concern" ? (
            <>
              <h1>당신의 속마음을 말해주세요.</h1>
              <p>자세하면 자세할 수록 좋아요!</p>
            </>
          ) : step === "meGender" ? (
            <h1>사주를 위한 성별을 알려주세요.</h1>
          ) : step === "meBirth" ? (
            <h1>당신의 사주부터 세워볼게요.</h1>
          ) : step === "partnerChoice" ? (
            partnerChoiceIsOpen ? (
              <h1>그 사람 사주도 넣을까요?</h1>
            ) : (
              <>
                <h1>이제 그 사람 차례예요.</h1>
                <p>두 명식을 나란히 놓아야 관계가 읽혀요.</p>
              </>
            )
          ) : (
            <h1>어떤 운명을 읽어볼까요?</h1>
          )}
        </header>
      )}

      {categorySelectionMode === "loading" ? (
        <div className="card reading-step-card" aria-live="polite">리딩 정보를 불러오고 있어요…</div>
      ) : (
        <>

          {!user && pendingReferral && (
            <aside className="friend-invite-banner" aria-label="친구 초대 안내">
              <div className="friend-invite-icon" aria-hidden>💌</div>
              <div>
                <span>친구 초대로 왔어요</span>
                <h2>내 가입으로 친구에게 질문권 10장이 적립돼요</h2>
                <p>나는 아래에서 사주 미리보기를 무료로 볼 수 있어요. 보상은 신규 회원 가입 완료 후 자동 지급됩니다.</p>
              </div>
            </aside>
          )}

          <section
            key={step}
            data-dir={stepDir}
            className={`reading-step-card${isDataEntryStep ? " reading-step-card--plain" : " card"}`}
            // 카드 안에는 제목을 두지 않는다 — 바로 위 진행바가 단계 이름을 보여준다.
            // 제목 요소가 없으므로 영역 이름은 여기서 직접 준다.
            aria-label={READING_STEP_LABELS[step]}
          >
            {step === "mode" && (
              <>
                <div className="reading-category-grid">
                  <button
                    type="button"
                    className={"reading-category-option" + (modeChosen && !withPartner ? " is-selected" : "")}
                    aria-pressed={modeChosen && !withPartner}
                    onClick={() => {
                      setWithPartner(false);
                      setModeChosen(true);
                    }}
                  >
                    <strong>혼자 볼 거예요</strong>
                  </button>
                  <button
                    type="button"
                    className={"reading-category-option" + (modeChosen && withPartner ? " is-selected" : "")}
                    aria-pressed={modeChosen && withPartner}
                    onClick={() => {
                      setWithPartner(true);
                      setModeChosen(true);
                    }}
                  >
                    <strong>그 사람과 함께 볼 거예요</strong>
                  </button>
                </div>
              </>
            )}

            {step === "category" && (
              <>
                <div className="reading-category-grid">
                  {/* 혼자/함께 선택에 맞는 상품만 보여준다. 여기서 커플 상품을 고르게
                      두면 상대 정보 없이 궁합을 사게 된다 — meDetails 주석의 그 사고다. */}
                  {CATEGORIES.filter((item) => item.needsPartner === withPartner).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`reading-category-option${hasChosenCategory && category === item.id ? " is-selected" : ""}`}
                      aria-pressed={hasChosenCategory && category === item.id}
                      onClick={() => {
                        if (item.id !== category) setOfferId(undefined);
                        setCategory(item.id);
                        setWithPartner(item.needsPartner);
                        setHasChosenCategory(true);
                      }}
                    >
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "meGender" && (
              <>
                <div className="reading-category-grid">
                  <button
                    type="button"
                    className={"reading-category-option" + (me.gender === "F" ? " is-selected" : "")}
                    aria-pressed={me.gender === "F"}
                    onClick={() => setMe({ ...me, gender: "F" })}
                  >
                    <strong>여성</strong>
                  </button>
                  <button
                    type="button"
                    className={"reading-category-option" + (me.gender === "M" ? " is-selected" : "")}
                    aria-pressed={me.gender === "M"}
                    onClick={() => setMe({ ...me, gender: "M" })}
                  >
                    <strong>남성</strong>
                  </button>
                </div>
              </>
            )}

            {step === "meBirth" && (
              <>
                <CalendarToggle value={me} onChange={setMe} />
                <BirthDateFields value={me} onChange={setMe} />
                {visibleMeBirthError && (
                  <p className="reading-step-error" role="alert">{visibleMeBirthError}</p>
                )}
              </>
            )}

            {step === "meDetails" && (
              /* 상대를 넣을지 묻던 체크박스는 여기 있었다. 내 정보 칸 아래 붙은
                 작은 체크 하나라 눈에 안 걸렸고, 그래서 두 사람 상품에서는 내
                 정보 다음 화면이 곧바로 남의 생년월일이었다. 이제 partnerChoice
                 화면이 그 일을 한다. */
              <PersonDetailsFields value={me} onChange={setMe} showGender={false} />
            )}

            {step === "partnerChoice" && partnerChoiceIsOpen && (
              <div className="reading-category-grid">
                <button
                  type="button"
                  className={"reading-category-option" + (partnerChosen && withPartner ? " is-selected" : "")}
                  aria-pressed={partnerChosen && withPartner}
                  onClick={() => {
                    setWithPartner(true);
                    setPartnerChosen(true);
                  }}
                >
                  <strong>넣을게요</strong>
                </button>
                <button
                  type="button"
                  className={"reading-category-option" + (partnerChosen && !withPartner ? " is-selected" : "")}
                  aria-pressed={partnerChosen && !withPartner}
                  onClick={() => {
                    setWithPartner(false);
                    setPartnerChosen(true);
                  }}
                >
                  <strong>나만 볼래요</strong>
                </button>
              </div>
            )}

            {step === "partnerChoice" && !partnerChoiceIsOpen && (
              <p className="reading-partner-intro">
                생년월일과 태어난 시간만 있으면 돼요. 모르는 시간은 모른다고 두셔도
                나머지 세 기둥은 그대로 섭니다.
              </p>
            )}

            {step === "partnerBirth" && (
              <>
                <CalendarToggle value={partner} onChange={setPartner} />
                <BirthDateFields value={partner} onChange={setPartner} />
              </>
            )}

            {step === "partnerDetails" && (
              <>
                <PersonDetailsFields value={partner} onChange={setPartner} />
              </>
            )}

            {step === "concern" && (
              <>
                <textarea
                  className="reading-concern-input"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value.slice(0, 80))}
                  placeholder="예: 답장이 자꾸 늦어지는데 마음이 식은 건지 모르겠어요"
                  rows={3}
                  maxLength={80}
                />
                <p className="reading-concern-count">{question.length} / 80</p>

                {/*
                  직업은 명식을 바꾸지 않는다 — 사주는 생년월일시로 정해진다.
                  다만 같은 흐름이 어떤 장면으로 나타나는지는 하는 일에 따라 달라져서,
                  이걸 적으면 리포트가 그 사람의 하루에서 장면을 고를 수 있다.
                  비워도 되는 칸이라 그 점을 안내 문구에 적어 둔다.
                */}
                <label className="reading-job">
                  <span className="reading-job-label">하는 일 (선택)</span>
                  <input
                    className="reading-job-input"
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value.slice(0, 30))}
                    placeholder="예: 3교대 간호사 / 프리랜서 디자이너 / 취업 준비 중"
                    maxLength={30}
                  />
                  <span className="reading-job-help">
                    사주 자체는 태어난 때로만 봐요. 적어주시면 그 흐름이 실제로 어떤 장면으로
                    나타나는지까지 짚어드려요.
                  </span>
                </label>
              </>
            )}

            {step === "ready" && selectedCategory && (
              <>
                {meChart && (
                  <SajuChart
                    chart={meChart}
                    name={user?.email?.split("@")[0]}
                    birthLine={personSummary(me)}
                  />
                )}
                <dl className="reading-summary">
                  <div>
                    <dt>리딩</dt>
                    <dd>{selectedCategory.label}</dd>
                  </div>
                  <div>
                    <dt>내 정보</dt>
                    <dd>{personSummary(me)}</dd>
                  </div>
                  {withPartner && (
                    <div>
                      <dt>그 사람 정보</dt>
                      <dd>{personSummary(partner)}</dd>
                    </div>
                  )}
                  {question.trim() && (
                    <div>
                      <dt>고민</dt>
                      <dd>{question.trim()}</dd>
                    </div>
                  )}
                  {occupation.trim() && (
                    <div>
                      <dt>하는 일</dt>
                      <dd>{occupation.trim()}</dd>
                    </div>
                  )}
                </dl>
                {loading && (
                  <p className="pulse reading-loading-copy">일주와 오행을 교차 분석하고 있어요…</p>
                )}
              </>
            )}
          </section>

          {error && <p className="reading-step-error" role="alert">{error}</p>}
        </>
      )}

      {showFixedAction && (
        <div key={"action-" + step} className="reading-fixed-action">
          <button type="button" className="btn" onClick={advanceStep} disabled={loading || !isStepComplete}>
            {loading
              ? "사주 푸는 중… 🔮"
              : step === "ready"
                // 무료가 아니게 됐다. 버튼이 무료라고 말해 놓고 다음 화면이
                // 결제를 요구하면, 속인 것이 된다.
                ? PAY_BEFORE_GENERATE ? "내 사주 세우기" : "무료로 운명 보기"
                : step === "partnerChoice" && !partnerChoiceIsOpen
                  ? "그 사람 사주 넣기"
                  : "다음으로"}
          </button>
        </div>
      )}

      {/* 로그인하면 그 자리에서 이어 간다. 폼으로 돌려보내면 방금 채운 것을
          다시 보게 되고, 그 화면에서 사람이 나간다. */}
      {pendingDraft && (
        <SignupModal
          onDone={(nextUser) => {
            setUser(nextUser);
            const draft = pendingDraft;
            setPendingDraft(null);
            if (draft) startGeneration(draft);
          }}
          onClose={() => setPendingDraft(null)}
          reason="내 사주를 세우려면 로그인이 필요해요"
        />
      )}

    </main>
  );
}
