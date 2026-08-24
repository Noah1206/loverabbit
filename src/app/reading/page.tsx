"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
type ReadingStep =
  | "category"
  | "meBirth"
  | "meDetails"
  | "partnerBirth"
  | "partnerDetails"
  | "mode"
  | "concern"
  | "ready";

const READING_STEP_LABELS: Record<ReadingStep, string> = {
  category: "리딩 선택",
  mode: "함께 볼 사람",
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
  // 혼자/함께 를 골랐는가. withPartner 의 기본값(true)과 "골랐다"는 별개라 따로 든다.
  const [modeChosen, setModeChosen] = useState(false);
  const [me, setMe] = useState<PersonForm>(emptyPerson);
  const [partner, setPartner] = useState<PersonForm>(emptyPerson);
  const [withPartner, setWithPartner] = useState(true);
  // 지금 가장 답답한 것 한 줄 — 선택 입력이지만, 있으면 리포트가 이 장면에 답한다
  const [question, setQuestion] = useState("");
  const [occupation, setOccupation] = useState("");
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
    // 광고·홈 카드로 들어와 상품이 정해져 있으면(found) 선택·mode 단계를 아예
    // 건너뛴다 — fixed 흐름. 아니면 picker 흐름으로 맨 뒤에서 고른다.
    setCategorySelectionMode(found ? "fixed" : "picker");
    setStep("meBirth");
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
    if (!user) {
      saveReadingDraft(draft);
      setShowSignup(true);
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
    if (step === "meBirth") {
      if (!showBirthError(me, "내", true)) moveTo("meDetails");
      return;
    }
    if (step === "meDetails") {
      // 입구에서 상품이 정해진 흐름은 상품이 상대 필요 여부를 이미 정했다.
      // 고르는 흐름은 mode 단계가 그걸 묻는다.
      if (categorySelectionMode === "fixed") {
        moveTo(withPartner ? "partnerBirth" : "concern");
      } else {
        moveTo("mode");
      }
      return;
    }
    if (step === "mode") {
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
        ? ["meBirth", "meDetails", "partnerBirth", "partnerDetails", "concern", "ready"]
        : ["meBirth", "meDetails", "concern", "ready"]
      : withPartner
        ? ["meBirth", "meDetails", "mode", "partnerBirth", "partnerDetails", "concern", "category", "ready"]
        : ["meBirth", "meDetails", "mode", "concern", "category", "ready"];
  const workflowStepIndex = Math.max(0, workflowSteps.indexOf(step));
  const progress = ((workflowStepIndex + 1) / workflowSteps.length) * 100;
  // 헤더의 < 버튼. 첫 단계에서는 흐름을 벗어나 홈으로 돌아간다.
  const goBack = () => {
    setError("");
    if (workflowStepIndex <= 0) {
      router.push("/");
      return;
    }
    setStep(workflowSteps[workflowStepIndex - 1]);
  };

  const showFixedAction = categorySelectionMode !== "loading" && (step !== "category" || hasChosenCategory);
  // 고민 단계도 머리글을 띄운다. 다른 입력 단계와 달리 무엇을 왜 적는지가
  // 컨트롤만 봐서는 드러나지 않는 자리다.
  const showIntroHeader =
    categorySelectionMode === "loading" ||
    step === "meBirth" ||
    step === "category" ||
    step === "concern";
  const isDataEntryStep = step === "meBirth"
    || step === "meDetails"
    || step === "partnerBirth"
    || step === "partnerDetails"
    || step === "concern";
  const isStepComplete = step === "category"
    ? hasChosenCategory
    : step === "mode"
    ? modeChosen
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
  /*
    입력이 다 차면 자동으로 다음 단계로 넘어간다 (운영자 요청, 2026-08-22).

    다만 세 가지는 지킨다.

    1. 이미 채워진 채로 들어온 화면에서는 안 넘어간다. 뒤로가기로 돌아온 사람을
       그 자리에서 다시 앞으로 튕기면, 고치러 온 사람이 고칠 수가 없다.
       화면에 들어온 순간 이미 완료였는지를 기억해 두고, 그 화면에 있는 동안
       미완료 -> 완료로 "바뀐" 경우에만 넘어간다.

    2. 타이핑 필드는 오래 기다린다. 일(日)에 "1"까지 친 순간도 유효한 값이라,
       바로 넘기면 "14"를 치려던 사람을 낚아챈다. 생년월일은 1.1초 손을 떼야
       넘어가고, 클릭·선택(시각/성별, 혼자/함께, 리딩 선택)은 뜻이 분명하니 짧다.

    3. 마지막 확인(ready)과 고민(concern)은 자동으로 안 넘어간다. 확인 화면의
       버튼은 제출이라 자동 제출이 되고, 고민은 선택 입력이라 "다 찼다"가 없다.
  */
  const AUTO_ADVANCE_DELAY: Partial<Record<ReadingStep, number>> = {
    meBirth: 1100,
    meDetails: 450,
    mode: 350,
    partnerBirth: 1100,
    partnerDetails: 450,
    category: 350,
  };
  const advanceRef = useRef(advanceStep);
  useEffect(() => {
    advanceRef.current = advanceStep;
  });
  // 화면에 들어온 순간 이미 완료였는가 — 선언 순서가 중요하다. 이 효과가 아래
  // 자동 진행 효과보다 먼저 돌아야 뒤로가기 직후의 완료 상태가 먼저 기록된다.
  const completeAtEntry = useRef(false);
  useEffect(() => {
    completeAtEntry.current = isStepComplete;
    // step 이 바뀐 순간의 완료 여부만 기록한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    const delay = AUTO_ADVANCE_DELAY[step];
    if (delay === undefined || loading) return;
    if (!isStepComplete) {
      // 들어와서 값을 지웠다 = 고치는 중. 다시 차면 그때는 넘어간다.
      completeAtEntry.current = false;
      return;
    }
    if (completeAtEntry.current) return;
    const timer = setTimeout(() => advanceRef.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isStepComplete, loading]);

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
      {/* 이 흐름 전용 상단바. 홈의 .app-header와 달리 뒤로 가기 하나만 둔다 —
          입력 중에 QR이나 로그인으로 새는 길을 만들지 않기 위해서다. */}
      <header className="reading-flow-topbar">
        <button type="button" onClick={goBack} aria-label={workflowStepIndex <= 0 ? "홈으로" : "이전 단계로"}>
          <span aria-hidden>‹</span>
          러브레빗
        </button>
      </header>

      {showIntroHeader && (
        <header className="reading-flow-header">
          {step === "concern" ? (
            <>
              <h1>당신의 속마음을 말해주세요.</h1>
              <p>자세하면 자세할 수록 좋아요!</p>
            </>
          ) : step === "meBirth" ? (
            <>
              <h1>당신의 사주부터 세워볼게요.</h1>
              <p>
                {activeOffer
                  ? "사주 정보를 차례로 입력하고 무료 결과를 먼저 확인하세요."
                  : "한 단계씩 입력하면 무료 운명 미리보기를 바로 확인할 수 있어요."}
              </p>
            </>
          ) : (
            <>
              <h1>어떤 운명을 읽어볼까요?</h1>
              <p>
                {activeOffer
                  ? "사주 정보를 차례로 입력하고 무료 결과를 먼저 확인하세요."
                  : "한 단계씩 입력하면 무료 운명 미리보기를 바로 확인할 수 있어요."}
              </p>
            </>
          )}
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
            // 카드 안에는 제목을 두지 않는다 — 바로 위 진행바가 단계 이름을 보여준다.
            // 제목 요소가 없으므로 영역 이름은 여기서 직접 준다.
            aria-label={READING_STEP_LABELS[step]}
          >
            {step === "mode" && (
              <>
                <p className="reading-step-note">
                  혼자 보면 내 흐름을 깊게, 함께 보면 두 명식을 맞대어 합과 충까지 읽어요.
                  다음에 나올 리딩 목록이 이 선택에 맞춰 갈려요.
                </p>
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

            {step === "meBirth" && (
              <>
                <p className="reading-step-note">
                  이 날짜에서 연·월·일 세 기둥이 나와요. 달은 절기로 갈려서, 월초에 태어났다면 하루 차이로 기둥이 바뀌기도 해요.
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
                <p className="reading-step-note">
                  태어난 시각이 네 번째 기둥이 되고, 성별은 태어난 해와 함께 대운이 흐르는 방향을 정해요. 시각을 모르면 세 기둥으로 읽고 그 사실을 결과에 밝혀둬요.
                </p>
                <PersonDetailsFields value={me} onChange={setMe} />
                {/*
                  두 사람을 보는 상품에서는 끄지 못하게 한다.

                  끌 수 있던 동안 궁합을 상대 없이 살 수 있었다. 그러면 두 명식을
                  잇는 규칙이 통째로 죽는다 — 상대를 넣으면 12절 중 못 채우는 절이
                  1%인데, 안 넣으면 70%가 된다. 리포트는 그래도 나오지만 상대 이야기가
                  본인 이야기의 되풀이가 되고, 그 값을 치른 사람은 두 사람을 보러 온
                  사람이다.

                  혼자 보는 상품에서는 그대로 고를 수 있게 둔다.
                */}
                {categorySelectionMode !== "fixed" ? null : selectedCategory?.needsPartner ? (
                  <p className="reading-step-note">
                    <strong>{selectedCategory.label}</strong>은 두 사람의 명식을 맞대어 보는
                    리포트예요. 다음 화면에서 그 사람의 정보도 받을게요.
                  </p>
                ) : (
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
                )}
              </>
            )}

            {step === "partnerBirth" && (
              <>
                <p className="reading-step-note">
                  그 사람의 기둥도 같은 방식으로 세워요. 두 명식을 맞대야 합과 충이 보여요.
                </p>
                <CalendarToggle value={partner} onChange={setPartner} />
                <BirthDateFields value={partner} onChange={setPartner} />
              </>
            )}

            {step === "partnerDetails" && (
              <>
                <p className="reading-step-note">
                  성별에 따라 배우자를 뜻하는 글자가 갈려요 — 여자는 관성, 남자는 재성으로 읽어요.
                </p>
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
              setOccupation(draft.occupation ?? "");
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
