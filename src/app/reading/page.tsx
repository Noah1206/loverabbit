"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PaymentModal from "@/components/PaymentModal";
import ChatSection from "@/components/ChatSection";
import SignupModal from "@/components/SignupModal";
import { saveToArchive, updateArchive } from "@/lib/archive";
import {
  savePendingReading,
  takePendingReading,
  type PendingReadingResult,
} from "@/lib/pending-reading";
import { clearUser, getUser, saveUser, type User } from "@/lib/user";
import {
  captureReferralFromLocation,
  type PendingReferral,
} from "@/lib/referral";

const CATEGORIES = [
  { id: "sokgunghap", label: "속궁합 🔥", needsPartner: true },
  { id: "jaehoe", label: "재회 🥀", needsPartner: true },
  { id: "bamgijil", label: "연애 기질 🐰", needsPartner: false },
  { id: "baramgi", label: "바람기 🚨", needsPartner: true },
  { id: "gyeolhon", label: "결혼 💍", needsPartner: true },
  { id: "gwontaegi", label: "권태기 🌧️", needsPartner: true },
  { id: "hwanseung", label: "환승 🚇", needsPartner: true },
  { id: "sseom", label: "썸 해부 💘", needsPartner: true },
  { id: "jjak", label: "짝사랑 🤫", needsPartner: true },
  { id: "bimil", label: "비밀연애 🤐", needsPartner: true },
  { id: "ibyeol", label: "이별 부검 🕯️", needsPartner: true },
  { id: "dohwasal", label: "도화살 🌸", needsPartner: false },
  { id: "insun", label: "인연 타이밍 ⏳", needsPartner: false },
  { id: "yeonae", label: "올해 연애운 ✨", needsPartner: false },
];

interface PersonForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: string;
}

const emptyPerson: PersonForm = { year: "", month: "", day: "", hour: "unknown", gender: "F" };

interface ReadingDraft {
  category: string;
  me: PersonForm;
  partner: PersonForm;
  withPartner: boolean;
  createdAt: number;
}

type CategorySelectionMode = "loading" | "fixed" | "picker";

const READING_DRAFT_KEY = "loverabbit_reading_draft_v1";
const READING_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function saveReadingDraft(draft: ReadingDraft): void {
  try {
    sessionStorage.setItem(READING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 저장이 막힌 브라우저에서도 로그인 창 자체는 정상적으로 열리게 둔다.
  }
}

function clearReadingDraft(): void {
  try {
    sessionStorage.removeItem(READING_DRAFT_KEY);
  } catch {
    // 이미 제거됐거나 스토리지를 사용할 수 없으면 무시한다.
  }
}

function takeReadingDraft(): ReadingDraft | null {
  try {
    const raw = sessionStorage.getItem(READING_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(READING_DRAFT_KEY);
    const draft = JSON.parse(raw) as ReadingDraft;
    if (
      !CATEGORIES.some((item) => item.id === draft?.category) ||
      !draft.me ||
      !draft.partner ||
      !Number.isFinite(draft.createdAt) ||
      Date.now() - draft.createdAt > READING_DRAFT_MAX_AGE_MS
    ) {
      return null;
    }
    return draft;
  } catch {
    clearReadingDraft();
    return null;
  }
}

type ReadingResult = PendingReadingResult;

interface ReferralStatus {
  referralCode: string;
  chatCredits: number;
  readingUnlocked: boolean;
}

function parsePerson(p: PersonForm) {
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour: p.hour === "unknown" ? null : parseInt(p.hour, 10),
    gender: p.gender,
  };
}

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
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <strong style={{ display: "block", marginBottom: 14 }}>{title}</strong>
      <div className="row field">
        <div>
          <label>출생연도</label>
          <input placeholder="1995" inputMode="numeric" value={value.year} onChange={(e) => set("year", e.target.value)} />
        </div>
        <div>
          <label>월</label>
          <input placeholder="7" inputMode="numeric" value={value.month} onChange={(e) => set("month", e.target.value)} />
        </div>
        <div>
          <label>일</label>
          <input placeholder="14" inputMode="numeric" value={value.day} onChange={(e) => set("day", e.target.value)} />
        </div>
      </div>
      <div className="row field" style={{ marginBottom: 0 }}>
        <div>
          <label>태어난 시간</label>
          <select value={value.hour} onChange={(e) => set("hour", e.target.value)}>
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
  const [categorySelectionMode, setCategorySelectionMode] = useState<CategorySelectionMode>("loading");
  const [me, setMe] = useState<PersonForm>(emptyPerson);
  const [partner, setPartner] = useState<PersonForm>(emptyPerson);
  const [withPartner, setWithPartner] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [pendingReferral, setPendingReferral] = useState<PendingReferral | null>(null);
  const [shareNotice, setShareNotice] = useState("");

  const generateReading = useCallback(async (nextUser: User, draft: ReadingDraft) => {
    setLoading(true);
    setError("");
    setResult(null);
    setFull(null);
    setScore(null);
    setShareNotice("");
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          me: parsePerson(draft.me),
          partner: draft.withPartner && draft.partner.year ? parsePerson(draft.partner) : null,
          userToken: nextUser.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needSignup) {
          saveReadingDraft(draft);
          clearUser();
          setUser(null);
          setShowSignup(true);
        }
        throw new Error(data.error ?? "리딩 생성 실패");
      }
      clearReadingDraft();
      setResult(data);
      // 내 상담 보관함에 자동 저장 (해금 시 full이 채워진다)
      saveToArchive({
        readingId: data.readingId,
        blob: data.blob,
        category: draft.category,
        label: CATEGORIES.find((item) => item.id === draft.category)?.label ?? draft.category,
        characterId: "",
        teaser: data.teaser,
        full: null,
        chart: data.chart,
        price: data.price,
        createdAt: Date.now(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 홈 상품 카드에서 ?c= 로 진입하면 해당 상품을 확정하고, 로그인 복귀 시 입력값으로 자동 재개한다.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    const found = CATEGORIES.find((x) => x.id === c);
    if (found) {
      setCategory(found.id);
      setWithPartner(found.needsPartner);
    }
    setCategorySelectionMode(found ? "fixed" : "picker");

    const stored = getUser();
    setUser(stored);
    if (stored) {
      const draft = takeReadingDraft();
      if (draft) {
        setCategory(draft.category);
        setMe(draft.me);
        setPartner(draft.partner);
        setWithPartner(draft.withPartner);
        setCategorySelectionMode("fixed");
        void generateReading(stored, draft);
      } else {
        const pending = takePendingReading();
        if (pending?.source === "reading") {
          setResult(pending.result);
          setCategory(pending.category);
          setWithPartner(CATEGORIES.find((item) => item.id === pending.category)?.needsPartner ?? false);
          setCategorySelectionMode("fixed");
          setShowPay(true);
        }
      }
    }
    if (stored?.referralCode) {
      setReferralStatus({
        referralCode: stored.referralCode,
        chatCredits: stored.chatCredits ?? 0,
        readingUnlocked: false,
      });
    }
    setPendingReferral(captureReferralFromLocation());
  }, [generateReading]);

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
    void generateReading(user, draft);
  };

  const startUnlock = () => {
    if (!result) return;
    if (!user) {
      savePendingReading({ source: "reading", category, result, createdAt: Date.now() });
      setShowSignup(true);
      return;
    }
    setShowPay(true);
  };

  // 계좌이체 확인 요청을 만든 뒤 관리자 승인 대기 페이지로 이동한다.
  // 실제 해금은 관리자가 입금을 확인해 주문을 승인했을 때만 처리된다.
  const depositorCode = result ? `레빗-${result.readingId.slice(0, 4).toUpperCase()}` : "";

  const confirmTransfer = async () => {
    if (!result) return;
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: result.readingId,
          blob: result.blob,
          method: "transfer",
          depositorCode,
          userToken: user?.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "입금 확인 요청 실패");
      if (!Number.isSafeInteger(Number(data.orderId))) {
        throw new Error("승인 대기 주문 번호를 받지 못했어요.");
      }
      updateArchive(result.readingId, { pendingOrderId: Number(data.orderId) });
      setShowPay(false);
      router.push(`/payment/pending?orderId=${encodeURIComponent(String(data.orderId))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  };

  const refreshReferralStatus = async (): Promise<ReferralStatus | null> => {
    if (!user) return null;
    const res = await fetch("/api/referral/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token, readingId: result?.readingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "보상 정보를 확인하지 못했어요.");
    const status = data as ReferralStatus;
    setReferralStatus(status);
    const nextUser = {
      ...user,
      referralCode: status.referralCode,
      chatCredits: status.chatCredits,
    };
    setUser(nextUser);
    saveUser(nextUser);
    return status;
  };

  const shareReward = async () => {
    if (!result || !user) return;
    setShareNotice("");
    try {
      const status = referralStatus?.referralCode ? referralStatus : await refreshReferralStatus();
      if (!status?.referralCode) throw new Error("초대 코드를 만들지 못했어요.");
      const params = new URLSearchParams({ ref: status.referralCode, reward: "chat_credits" });
      const url = `${window.location.origin}/reading?${params.toString()}`;
      const text = "러브레빗 캐릭터챗 같이 해보자. 가입하면 무료 사주 10문장도 볼 수 있어 🐰";
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 보상이 자동 지급돼요.");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNotice("초대 링크를 복사했어요. 친구가 가입하면 보상이 자동 지급돼요.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setShareNotice(e instanceof Error ? e.message : "공유 링크를 만들지 못했어요.");
    }
  };

  const selectedCategory = CATEGORIES.find((item) => item.id === category);

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
        <li><strong>3</strong><span>약 10문장 무료</span></li>
        <li><strong>4</strong><span>결제 후 전문</span></li>
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
          {!loading && !result && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "8px 12px", fontSize: "0.82rem" }}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.delete("c");
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

      {result && (
        <section style={{ marginTop: 36 }}>
          <div className="card" style={{ marginBottom: 16, fontSize: "0.85rem", color: "var(--text-dim)" }}>
            <strong style={{ color: "var(--gold)" }}>내 사주</strong> {result.chart.me}
            {result.chart.partner && (
              <>
                <br />
                <strong style={{ color: "var(--gold)" }}>그 사람</strong> {result.chart.partner}
              </>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16, borderColor: "var(--violet)" }}>
            <span className="badge" style={{ marginBottom: 10 }}>무료 핵심 요약</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{result.teaser}</p>
            {result.scoreLabel && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-dim)" }}>🔮 {result.scoreLabel}</span>
                {score !== null ? (
                  <strong style={{ fontSize: "1.15rem", color: "var(--accent)" }}>상위 {100 - score}%</strong>
                ) : (
                  <strong style={{ fontSize: "1.15rem", color: "var(--text-dim)" }}>상위 ??% 🔒</strong>
                )}
              </div>
            )}
          </div>

          {full ? (
            <div className="card">
              <span className="badge" style={{ marginBottom: 10 }}>🔓 풀 리딩</span>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{full}</p>
            </div>
          ) : (
            <div className="card reading-preview-card">
              <div className="reading-preview-heading">
                <div>
                  <span className="badge">무료 미리보기</span>
                  <h2>핵심 요약까지 합쳐 약 10문장을 먼저 보여드려요</h2>
                </div>
                <span>🔒 전문 잠금</span>
              </div>

              <div className="reading-preview-sections">
                {result.previewSections.map((section, index) => (
                  <article key={`${section.title}-${index}`}>
                    <small>SECTION {String(index + 1).padStart(2, "0")}</small>
                    <h3>{section.title}</h3>
                    <p>{section.excerpt}</p>
                    <div className="preview-blur-lines" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                ))}
              </div>

              {result.lockedSectionTitles.length > 0 && (
                <div className="locked-toc" aria-label="잠긴 추가 목차">
                  <strong>이어서 나오는 {result.lockedSectionTitles.length}개 분석</strong>
                  {result.lockedSectionTitles.slice(0, 5).map((title) => <span key={title}>■ {title}</span>)}
                </div>
              )}

              <div className="reading-paywall">
                <strong>결론·정확한 시기·행동 가이드는 전문에 있어요</strong>
                <button className="btn" onClick={startUnlock} disabled={paying}>
                  {paying
                    ? "결제 준비 중…"
                    : user
                      ? `결제하고 전문 보기 — ${result.price.toLocaleString()}원`
                      : `로그인 후 전문 보기 — ${result.price.toLocaleString()}원`}
                </button>
                <p>점집 1회 5만원보다 가볍게, 한 번 결제로 계속 보관</p>
              </div>
            </div>
          )}

          {!full && user && (
            <div className="referral-reward-card">
              <span className="badge">친구 초대 보상</span>
              <h2>친구가 가입하면 추가 상담권을 드려요</h2>
              <p>전문 리딩은 결제 후 열리고, 친구 초대 보상은 추가 질문에 사용할 수 있어요.</p>
              <div className="referral-reward-options referral-reward-options-single">
                <button onClick={() => void shareReward()}>
                  <strong>캐릭터챗 질문권 10장</strong>
                  <span>친구 1명 가입 시 바로 적립</span>
                </button>
              </div>
              <small>링크 클릭이 아니라 친구의 실제 가입이 완료되어야 지급돼요.</small>
              {shareNotice && <p className="referral-notice">{shareNotice}</p>}
            </div>
          )}

          {full && (
            <ChatSection readingId={result.readingId} blob={result.blob} />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-ghost"
              style={{ width: "100%" }}
              onClick={() => downloadShareImage(result.teaser)}
            >
              📸 공유 이미지 저장
            </button>
          </div>
          {result.demo && (
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 12 }}>
              ⚙️ 데모 모드로 동작 중 — .env에 API 키를 넣으면 실제 AI 리딩이 생성됩니다.
            </p>
          )}
        </section>
      )}

      {showSignup && (
        <SignupModal
          onDone={(u) => {
            setUser(u);
            setShowSignup(false);
            setPendingReferral(null);
            setReferralStatus(
              u.referralCode
                ? { referralCode: u.referralCode, chatCredits: u.chatCredits ?? 0, readingUnlocked: false }
                : null
            );
            const draft = takeReadingDraft();
            if (draft) {
              setCategory(draft.category);
              setMe(draft.me);
              setPartner(draft.partner);
              setWithPartner(draft.withPartner);
              setCategorySelectionMode("fixed");
              void generateReading(u, draft);
            } else if (result) {
              setShowPay(true);
            }
          }}
          reason={
            pendingReferral
              ? "친구 초대로 왔어요. 가입하면 무료 미리보기와 친구 보상이 함께 연결돼요"
              : result
                ? "전문 리딩을 열려면 로그인이 필요해요"
                : "무료 사주 10문장을 보려면 로그인이 필요해요. 로그인 후 입력한 내용으로 바로 이어집니다"
          }
          onClose={() => {
            clearReadingDraft();
            setShowSignup(false);
          }}
        />
      )}

      {showPay && result && user && (
        <PaymentModal
          readingId={result.readingId}
          price={result.price}
          userToken={user.token}
          customerEmail={user.email}
          depositorCode={depositorCode}
          paying={paying}
          onTransferSubmitted={confirmTransfer}
          onClose={() => setShowPay(false)}
        />
      )}
    </main>
  );
}
