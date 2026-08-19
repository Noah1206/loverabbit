"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PRODUCTS } from "@/lib/products";
import { resolveAdOffer } from "@/lib/ad-offers";
import { useRouter } from "next/navigation";
import SignupModal from "@/components/SignupModal";
import {
  clearReadingDraft,
  emptyPerson,
  peekReadingDraft,
  saveReadingDraft,
  type PersonForm,
  type ReadingDraft,
} from "@/lib/reading-draft";
import { getUser, type User } from "@/lib/user";
import { hasLeapMonth, lunarToSolar } from "@/lib/lunar";
import {
  captureReferralFromLocation,
  type PendingReferral,
} from "@/lib/referral";
import {
  landingTypeForProduct,
  trackSajuFormCompleted,
  trackSajuFormStarted,
} from "@/lib/meta-events";

// 카테고리 목록은 상품 카탈로그에서 파생한다 (상품 추가 시 여기 손댈 필요 없음)
const CATEGORIES = PRODUCTS.map((p) => ({
  id: p.id,
  label: p.shortLabel,
  needsPartner: p.needsPartner,
}));

type CategorySelectionMode = "loading" | "fixed" | "picker";
type ReadingStep =
  | "category"
  | "meBirth"
  | "meDetails"
  | "partnerBirth"
  | "partnerDetails"
  | "concern"
  | "ready";

const READING_STEP_LABELS: Record<ReadingStep, string> = {
  category: "리딩 선택",
  meBirth: "내 생년월일",
  meDetails: "내 출생 정보",
  partnerBirth: "그 사람 생년월일",
  partnerDetails: "그 사람 출생 정보",
  concern: "지금의 고민",
  ready: "무료 운명보기",
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
  if (isNaN(month) || month < 1 || month > 12) return `${who} 월은 1~12 사이여야 해요.`;
  if (isNaN(day) || day < 1 || day > (lunar ? 30 : 31)) {
    return `${who} 일은 1~${lunar ? 30 : 31} 사이여야 해요.`;
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
  bg.addColorStop(0, "#17121f");
  bg.addColorStop(1, "#0d0a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2c2338";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff3d7f";
  ctx.font = "bold 56px 'Malgun Gothic', sans-serif";
  ctx.fillText("🐰 러브레빗", W / 2, 180);
  ctx.fillStyle = "#a99cbb";
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
  ctx.fillStyle = "#a99cbb";
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

  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // 숫자만 받고, 자리수가 차면 다음 칸으로 자동으로 넘긴다.
  // soloJumpFrom: 한 글자만으로 값이 확정되는 경계.
  //   월은 2~9로 시작하면 두 자리가 될 수 없고(10·11·12는 모두 1로 시작),
  //   일은 4~9로 시작하면 두 자리가 될 수 없다(10~31은 1·2·3으로 시작).
  const setDigits = (
    key: "year" | "month" | "day",
    raw: string,
    maxLen: number,
    next: HTMLInputElement | HTMLSelectElement | null,
    soloJumpFrom?: number,
  ) => {
    const digits = raw.replace(/\D/g, "").slice(0, maxLen);
    set(key, digits);
    const filled = digits.length === maxLen;
    const decided = soloJumpFrom !== undefined && digits.length === 1 && Number(digits) >= soloJumpFrom;
    if (next && (filled || decided)) next.focus();
  };

  // 빈 칸에서 백스페이스를 누르면 앞 칸으로 되돌아간다.
  const backspaceToPrev =
    (current: string, prev: HTMLInputElement | null) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && current === "" && prev) prev.focus();
    };

  return (
    <div className="reading-birth-grid">
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-year">연도</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-year"
            ref={yearRef}
            placeholder="1995"
            inputMode="numeric"
            autoComplete="bday-year"
            maxLength={4}
            value={value.year}
            onChange={(e) => setDigits("year", e.target.value, 4, monthRef.current)}
          />
          <span aria-hidden="true">년</span>
        </div>
      </div>
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-month">월</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-month"
            ref={monthRef}
            placeholder="07"
            inputMode="numeric"
            autoComplete="bday-month"
            maxLength={2}
            value={value.month}
            onChange={(e) => setDigits("month", e.target.value, 2, dayRef.current, 2)}
            onKeyDown={backspaceToPrev(value.month, yearRef.current)}
          />
          <span aria-hidden="true">월</span>
        </div>
      </div>
      <div className="reading-birth-field">
        <label htmlFor="reading-birth-day">일</label>
        <div className="reading-birth-control">
          <input
            id="reading-birth-day"
            ref={dayRef}
            placeholder="14"
            inputMode="numeric"
            autoComplete="bday-day"
            maxLength={2}
            value={value.day}
            onChange={(e) => setDigits("day", e.target.value, 2, null, 4)}
            onKeyDown={backspaceToPrev(value.day, monthRef.current)}
          />
          <span aria-hidden="true">일</span>
        </div>
      </div>
    </div>
  );
}

function PersonDetailsFields({
  value,
  onChange,
}: {
  value: PersonForm;
  onChange: (v: PersonForm) => void;
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
      <div>
        <label htmlFor="reading-gender">성별</label>
        <select id="reading-gender" value={value.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="" disabled>선택해주세요</option>
          <option value="F">여성</option>
          <option value="M">남성</option>
        </select>
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const router = useRouter();
  const [category, setCategory] = useState("sokgunghap");
  const [offerId, setOfferId] = useState<string | undefined>();
  const [categorySelectionMode, setCategorySelectionMode] = useState<CategorySelectionMode>("loading");
  const [step, setStep] = useState<ReadingStep>("category");
  const [hasChosenCategory, setHasChosenCategory] = useState(false);
  const [me, setMe] = useState<PersonForm>(emptyPerson);
  const [partner, setPartner] = useState<PersonForm>(emptyPerson);
  const [withPartner, setWithPartner] = useState(true);
  // 지금 가장 답답한 것 한 줄 — 선택 입력이지만, 있으면 리포트가 이 장면에 답한다
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [pendingReferral, setPendingReferral] = useState<PendingReferral | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

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

  // 생성은 이 화면에서 하지 않는다. 초안만 남기고 대기 화면으로 넘겨, 18초의 기다림이
  // 폼이 아니라 결과 쪽에서 일어나게 한다.
  const startGeneration = useCallback(
    (draft: ReadingDraft) => {
      setLoading(true);
      setError("");
      saveReadingDraft(draft);
      const landing = landingTypeForProduct(draft.category, draft.offerId);
      if (landing) trackSajuFormCompleted(landing);
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
    setCategorySelectionMode("picker");
    setStep("category");
    setHasChosenCategory(Boolean(found));

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
      setCategorySelectionMode("fixed");
      setHasChosenCategory(true);
      if (stored) {
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
      createdAt: Date.now(),
    };
    if (!user) {
      saveReadingDraft(draft);
      setShowSignup(true);
      return;
    }
    startGeneration(draft);
  };

  const selectedCategory = CATEGORIES.find((item) => item.id === category);
  const activeOffer = resolveAdOffer(category, offerId);

  const moveTo = (nextStep: ReadingStep) => {
    setError("");
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
    setCategorySelectionMode("fixed");
    moveTo("meBirth");
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
    if (step === "category") {
      confirmCategory();
      return;
    }
    if (step === "meBirth") {
      if (!showBirthError(me, "내", true)) moveTo("meDetails");
      return;
    }
    if (step === "meDetails") {
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
      moveTo("ready");
      return;
    }
    submit();
  };

  const workflowSteps: readonly ReadingStep[] = withPartner
    ? ["category", "meBirth", "meDetails", "partnerBirth", "partnerDetails", "concern", "ready"]
    : ["category", "meBirth", "meDetails", "concern", "ready"];
  const workflowStepIndex = Math.max(0, workflowSteps.indexOf(step));
  const progress = ((workflowStepIndex + 1) / workflowSteps.length) * 100;
  const showFixedAction = categorySelectionMode !== "loading" && (step !== "category" || hasChosenCategory);
  const showIntroHeader = categorySelectionMode === "loading" || step === "category";
  const isDataEntryStep = step === "meBirth"
    || step === "meDetails"
    || step === "partnerBirth"
    || step === "partnerDetails"
    || step === "concern";
  const isStepComplete = step === "category"
    ? hasChosenCategory
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

  useEffect(() => {
    if (categorySelectionMode === "loading") return;
    const frame = window.requestAnimationFrame(() => setAnimatedProgress(progress));
    return () => window.cancelAnimationFrame(frame);
  }, [categorySelectionMode, progress]);

  return (
    <main className="container reading-flow-page">
      {showIntroHeader && (
        <header className="reading-flow-header">
          <h1>어떤 운명을 읽어볼까요?</h1>
          <p>
            {activeOffer
              ? "사주 정보를 차례로 입력하고 무료 결과를 먼저 확인하세요. 전체 리포트는 원할 때만 990원이에요."
              : "한 단계씩 입력하면 무료 운명 미리보기를 바로 확인할 수 있어요."}
          </p>
        </header>
      )}

      {categorySelectionMode === "loading" ? (
        <div className="card reading-step-card" aria-live="polite">리딩 정보를 불러오고 있어요…</div>
      ) : (
        <>
          <div className="reading-flow-progress" aria-label={`입력 진행 단계 ${workflowStepIndex + 1}/${workflowSteps.length}`}>
            <div className="reading-flow-progress-copy">
              <span>{READING_STEP_LABELS[step]}</span>
              <strong>{workflowStepIndex + 1} / {workflowSteps.length}</strong>
            </div>
            <div className="reading-flow-progress-track" aria-hidden="true">
              <span style={{ transform: `scaleX(${animatedProgress / 100})` }} />
            </div>
          </div>

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
            className={`reading-step-card${isDataEntryStep ? " reading-step-card--plain" : " card"}`}
            aria-labelledby="reading-step-title"
          >
            {step === "category" && (
              <>
                <p className="reading-step-kicker">STEP 1</p>
                <h2 id="reading-step-title">어떤 걸 리딩할까요?</h2>
                <p className="reading-step-description">지금 가장 궁금한 운명을 하나 선택해주세요.</p>
                <div className="reading-category-grid">
                  {CATEGORIES.map((item) => (
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
                      <span>{item.needsPartner ? "두 사람의 흐름 리딩" : "나의 운명 흐름 리딩"}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "meBirth" && (
              <>
                <p className="reading-step-kicker">내 정보</p>
                <h2 id="reading-step-title">내 생년월일을 입력해주세요</h2>
                <p className="reading-step-description">
                  양력이 기본이에요. 음력 생일만 안다면 위에서 음력으로 바꿔 입력하세요.
                </p>
                <CalendarToggle value={me} onChange={setMe} />
                <BirthDateFields value={me} onChange={setMe} />
                {visibleMeBirthError && (
                  <p className="reading-step-error" role="alert">{visibleMeBirthError}</p>
                )}
              </>
            )}

            {step === "meDetails" && (
              <>
                <p className="reading-step-kicker">내 정보</p>
                <h2 id="reading-step-title">태어난 시각과 성별을 알려주세요</h2>
                <p className="reading-step-description">태어난 시간을 모르면 ‘모름’을 선택해도 괜찮아요.</p>
                <PersonDetailsFields value={me} onChange={setMe} />
                <label className="reading-partner-toggle">
                  <input
                    type="checkbox"
                    checked={withPartner}
                    onChange={(event) => setWithPartner(event.target.checked)}
                  />
                  <span>
                    <strong>그 사람 정보도 넣기</strong>
                    <small>체크하면 같은 순서로 그 사람의 정보를 입력해요.</small>
                  </span>
                </label>
              </>
            )}

            {step === "partnerBirth" && (
              <>
                <p className="reading-step-kicker">그 사람 정보</p>
                <h2 id="reading-step-title">그 사람의 생년월일을 입력해주세요</h2>
                <p className="reading-step-description">정확히 모르는 정보는 확인한 뒤 입력하는 것이 좋아요.</p>
                <CalendarToggle value={partner} onChange={setPartner} />
                <BirthDateFields value={partner} onChange={setPartner} />
              </>
            )}

            {step === "partnerDetails" && (
              <>
                <p className="reading-step-kicker">그 사람 정보</p>
                <h2 id="reading-step-title">태어난 시각과 성별을 알려주세요</h2>
                <p className="reading-step-description">그 사람의 태어난 시간을 모르면 ‘모름’을 선택해주세요.</p>
                <PersonDetailsFields value={partner} onChange={setPartner} />
              </>
            )}

            {step === "concern" && (
              <>
                <p className="reading-step-kicker">마지막 한 가지</p>
                <h2 id="reading-step-title">지금 가장 답답한 게 뭔가요?</h2>
                <p className="reading-step-description">
                  한 줄만 적어두면 그 장면을 중심으로 풀어드려요. 건너뛰어도 괜찮아요.
                </p>
                <textarea
                  className="reading-concern-input"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value.slice(0, 80))}
                  placeholder="예: 답장이 자꾸 늦어지는데 마음이 식은 건지 모르겠어요"
                  rows={3}
                  maxLength={80}
                />
                <p className="reading-concern-count">{question.length} / 80</p>
              </>
            )}

            {step === "ready" && selectedCategory && (
              <>
                <p className="reading-step-kicker">입력 완료</p>
                <h2 id="reading-step-title">무료 운명 미리보기를 준비했어요</h2>
                <p className="reading-step-description">입력한 정보를 확인하고 무료로 결과를 열어보세요.</p>
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
        <div key={step} className="reading-fixed-action">
          <button type="button" className="btn" onClick={advanceStep} disabled={loading || !isStepComplete}>
            {loading ? "사주 푸는 중… 🔮" : step === "ready" ? "무료로 운명 보기" : "다음으로"}
          </button>
        </div>
      )}

      {showSignup && (
        <SignupModal
          title="운명의 답, 지금 열어보세요"
          onDone={(u) => {
            setUser(u);
            setShowSignup(false);
            setPendingReferral(null);
            const draft = peekReadingDraft();
            if (draft) {
              setCategory(draft.category);
              setOfferId(draft.offerId);
              setMe(draft.me);
              setPartner(draft.partner);
              setWithPartner(draft.withPartner);
              setQuestion(draft.question ?? "");
              setCategorySelectionMode("fixed");
              startGeneration(draft);
            }
          }}
          reason={
            pendingReferral
              ? "로그인하면 무료 미리보기와 친구 보상이 함께 연결돼요."
              : "로그인하면 입력한 내용 그대로 무료 미리보기로 이어져요."
          }
          onClose={() => {
            clearReadingDraft();
            setShowSignup(false);
          }}
        />
      )}
    </main>
  );
}
