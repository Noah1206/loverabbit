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

// 생년월일 유효성 검사 — 서버에서도 한 번 더 검증하지만, 여기서 먼저 친절하게 막는다
function birthError(p: PersonForm, who: string): string | null {
  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  const nowYear = new Date().getFullYear();
  if (isNaN(year) || year < 1900 || year > nowYear) return `${who} 출생연도를 확인해주세요 (1900~${nowYear}).`;
  if (isNaN(month) || month < 1 || month > 12) return `${who} 월은 1~12 사이여야 해요.`;
  if (isNaN(day) || day < 1 || day > 31) return `${who} 일은 1~31 사이여야 해요.`;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return `${who} ${month}월 ${day}일은 없는 날짜예요.`;
  if (d.getTime() > Date.now()) return `${who} 생일이 미래일 수는 없어요.`;
  return null;
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

function PersonFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PersonForm;
  onChange: (v: PersonForm) => void;
}) {
  const set = (k: keyof PersonForm, v: string) => onChange({ ...value, [k]: v });

  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLSelectElement>(null);

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
    <div className="card" style={{ marginBottom: 18 }}>
      <strong style={{ display: "block", marginBottom: 14 }}>{title}</strong>
      <div className="row field">
        <div>
          <label>출생연도</label>
          <input
            ref={yearRef}
            placeholder="1995"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={value.year}
            onChange={(e) => setDigits("year", e.target.value, 4, monthRef.current)}
          />
        </div>
        <div>
          <label>월</label>
          <input
            ref={monthRef}
            placeholder="7"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            value={value.month}
            onChange={(e) => setDigits("month", e.target.value, 2, dayRef.current, 2)}
            onKeyDown={backspaceToPrev(value.month, yearRef.current)}
          />
        </div>
        <div>
          <label>일</label>
          <input
            ref={dayRef}
            placeholder="14"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            value={value.day}
            onChange={(e) => setDigits("day", e.target.value, 2, hourRef.current, 4)}
            onKeyDown={backspaceToPrev(value.day, monthRef.current)}
          />
        </div>
      </div>
      <div className="row field" style={{ marginBottom: 0 }}>
        <div>
          <label>태어난 시간</label>
          <select ref={hourRef} value={value.hour} onChange={(e) => set("hour", e.target.value)}>
            <option value="unknown">모름</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{h}시</option>
            ))}
          </select>
        </div>
        <div>
          <label>성별</label>
          <select value={value.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="F">여성</option>
            <option value="M">남성</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const router = useRouter();
  const [category, setCategory] = useState("sokgunghap");
  const [offerId, setOfferId] = useState<string | undefined>();
  const [categorySelectionMode, setCategorySelectionMode] = useState<CategorySelectionMode>("loading");
  const [me, setMe] = useState<PersonForm>(emptyPerson);
  const [partner, setPartner] = useState<PersonForm>(emptyPerson);
  const [withPartner, setWithPartner] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
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

  // 홈 상품 카드에서 ?c= 로 진입하면 해당 상품을 확정하고, 로그인 복귀 시 입력값으로 자동 재개한다.
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
    setCategorySelectionMode(found ? "fixed" : "picker");

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
      setCategorySelectionMode("fixed");
      if (stored) startGeneration(draft);
    }
    setPendingReferral(captureReferralFromLocation());
  }, [startGeneration]);

  const validateForm = (): string | null => {
    if (!me.year || !me.month || !me.day) {
      return "본인 생년월일을 입력해주세요.";
    }
    const myErr = birthError(me, "내");
    if (myErr) return myErr;
    if (withPartner && partner.year) {
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

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 6 }}>
        {categorySelectionMode === "fixed" && selectedCategory
          ? `${selectedCategory.label} 리딩`
          : "🐰 마음 리딩"}
      </h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 28 }}>
        {categorySelectionMode === "fixed" && selectedCategory
          ? "이미 선택한 리딩이에요. 사주 정보만 입력하면 바로 이어집니다."
          : "혼자 고민하던 연애 질문을 사주 흐름으로 풀어보세요."}
      </p>

      <ol className="preview-funnel-steps" aria-label="무료 미리보기 이용 순서">
        <li><strong>1</strong><span>사주 입력</span></li>
        <li><strong>2</strong><span>로그인</span></li>
        <li><strong>3</strong><span>{activeOffer ? "무료 운명보기" : "약 10문장 무료"}</span></li>
        <li><strong>4</strong><span>{activeOffer ? "원할 때 990원" : "결제 후 전문"}</span></li>
      </ol>

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

      {categorySelectionMode === "fixed" && selectedCategory && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 22,
            padding: "14px 16px",
          }}
        >
          <div>
            <small style={{ display: "block", color: "var(--text-dim)", marginBottom: 4 }}>선택한 리딩</small>
            <strong>{selectedCategory.label}</strong>
          </div>
          {!loading && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "8px 12px", fontSize: "0.82rem" }}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete("c");
                params.delete("offer");
                setOfferId(undefined);
                setCategorySelectionMode("picker");
                router.replace(`/reading${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
              }}
            >
              다른 리딩 선택
            </button>
          )}
        </div>
      )}

      {categorySelectionMode === "picker" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={category === item.id ? "btn" : "btn btn-ghost"}
              style={{ padding: "10px 18px", fontSize: "0.92rem" }}
              onClick={() => {
                setCategory(item.id);
                setOfferId(undefined);
                setWithPartner(item.needsPartner);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <PersonFields title="👤 내 정보" value={me} onChange={setMe} />

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={withPartner}
          onChange={(e) => setWithPartner(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        <span style={{ color: "var(--text)" }}>그 사람 정보도 넣기 (관계 분석 정확도 ↑)</span>
      </label>

      {withPartner && <PersonFields title="💕 그 사람 정보" value={partner} onChange={setPartner} />}

      <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={loading}>
        {loading
          ? "사주 푸는 중… 🔮"
          : activeOffer
            ? user
              ? "무료로 운명보기 →"
              : "로그인하고 무료로 운명보기 →"
            : user
              ? "무료 10문장 보기 →"
              : "로그인하고 무료 10문장 보기 →"}
      </button>
      {loading && (
        <p className="pulse" style={{ textAlign: "center", color: "var(--text-dim)", marginTop: 14 }}>
          일주와 오행을 교차 분석하고 있어요…
        </p>
      )}
      {error && <p style={{ color: "var(--accent)", marginTop: 14 }}>{error}</p>}

      {showSignup && (
        <SignupModal
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
              setCategorySelectionMode("fixed");
              startGeneration(draft);
            }
          }}
          reason={
            pendingReferral
              ? "친구 초대로 왔어요. 가입하면 무료 미리보기와 친구 보상이 함께 연결돼요"
              : activeOffer
                ? "무료 운명 미리보기를 저장하려면 로그인이 필요해요. 로그인 후 입력한 내용으로 바로 이어집니다"
                : "무료 사주 10문장을 보려면 로그인이 필요해요. 로그인 후 입력한 내용으로 바로 이어집니다"
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
