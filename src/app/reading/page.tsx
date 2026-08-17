"use client";

import { useEffect, useState } from "react";
import PaymentModal from "@/components/PaymentModal";
import ChatSection from "@/components/ChatSection";
import SignupModal from "@/components/SignupModal";
import { saveToArchive, updateArchive } from "@/lib/archive";
import { getUser, saveUser, type User } from "@/lib/user";
import { captureReferralFromLocation, type ReferralRewardChoice } from "@/lib/referral";

const CATEGORIES = [
  { id: "sokgunghap", label: "속궁합 🔥", needsPartner: true },
  { id: "jaehoe", label: "재회 🥀", needsPartner: true },
  { id: "bamgijil", label: "밤 기질 🐰", needsPartner: false },
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

interface ReadingResult {
  readingId: string;
  teaser: string;
  chart: { me: string; partner: string | null };
  price: number;
  blob: string;
  previewSections: { title: string; excerpt: string }[];
  lockedSectionTitles: string[];
  scoreLabel?: string | null;
  demo: boolean;
}

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
  ctx.fillText("만 19세 이상 · 속궁합 특화 AI 사주", W / 2, H - 110);

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
  const [category, setCategory] = useState("sokgunghap");
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
  const [shareNotice, setShareNotice] = useState("");
  const [checkingReward, setCheckingReward] = useState(false);

  // 홈 상품 카드에서 ?c= 로 진입하면 해당 카테고리를 자동 선택한다.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    const found = CATEGORIES.find((x) => x.id === c);
    if (found) {
      setCategory(found.id);
      setWithPartner(found.needsPartner);
    }
    const stored = getUser();
    setUser(stored);
    if (stored?.referralCode) {
      setReferralStatus({
        referralCode: stored.referralCode,
        chatCredits: stored.chatCredits ?? 0,
        readingUnlocked: false,
      });
    }
    captureReferralFromLocation();
  }, []);

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

  const generateReading = async (nextUser: User) => {
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
          category,
          me: parsePerson(me),
          partner: withPartner && partner.year ? parsePerson(partner) : null,
          userToken: nextUser.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needSignup) setShowSignup(true);
        throw new Error(data.error ?? "리딩 생성 실패");
      }
      setResult(data);
      // 내 상담 보관함에 자동 저장 (해금 시 full이 채워진다)
      saveToArchive({
        readingId: data.readingId,
        blob: data.blob,
        category,
        label: CATEGORIES.find((c) => c.id === category)?.label ?? category,
        characterId: "",
        teaser: data.teaser,
        full: null,
        chart: data.chart,
        price: data.price,
        createdAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) {
      setShowSignup(true);
      return;
    }
    void generateReading(user);
  };

  // 결제: 지금은 계좌이체(토스 송금 딥링크) 방식.
  // PG 가맹 완료 후에는 토스페이먼츠 결제위젯으로 교체 — /api/unlock의 toss-pg 경로가 이미 준비돼 있다.
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
      if (!res.ok) throw new Error((await res.json()).error ?? "해금 실패");
      const data = await res.json();
      setFull(data.full);
      setScore(data.score ?? null);
      updateArchive(result.readingId, { full: data.full });
      setShowPay(false);
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

  const shareReward = async (reward: ReferralRewardChoice) => {
    if (!result || !user) return;
    setShareNotice("");
    try {
      const status = referralStatus?.referralCode ? referralStatus : await refreshReferralStatus();
      if (!status?.referralCode) throw new Error("초대 코드를 만들지 못했어요.");
      const params = new URLSearchParams({ ref: status.referralCode, reward });
      if (reward === "reading_unlock") params.set("rid", result.readingId);
      const url = `${window.location.origin}/reading?${params.toString()}`;
      const text =
        reward === "reading_unlock"
          ? "내 연애 사주 미리보기, 생각보다 소름이었어. 너도 무료로 봐봐 🐰"
          : "러브레빗 캐릭터챗 같이 해보자. 가입하면 무료 사주 미리보기도 볼 수 있어 🐰";
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

  const checkReferralUnlock = async () => {
    if (!result || !user) return;
    setCheckingReward(true);
    setShareNotice("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: result.readingId,
          blob: result.blob,
          method: "referral",
          userToken: user.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "보상을 확인하지 못했어요.");
      setFull(data.full);
      setScore(data.score ?? null);
      updateArchive(result.readingId, { full: data.full });
      setShareNotice("친구 가입이 확인되어 이 리딩을 무료로 열었어요 🎉");
      await refreshReferralStatus();
    } catch (e) {
      setShareNotice(e instanceof Error ? e.message : "보상을 확인하지 못했어요.");
    } finally {
      setCheckingReward(false);
    }
  };

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 6 }}>🐰 밤의 리딩</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 28 }}>
        어디 가서 못 물어보는 질문, 여기서 해결하세요.
      </p>

      <ol className="preview-funnel-steps" aria-label="무료 미리보기 이용 순서">
        <li><strong>1</strong><span>사주 입력</span></li>
        <li><strong>2</strong><span>3초 가입</span></li>
        <li><strong>3</strong><span>약 10문장 무료</span></li>
        <li><strong>4</strong><span>결제·친구 초대</span></li>
      </ol>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? "btn" : "btn btn-ghost"}
            style={{ padding: "10px 18px", fontSize: "0.92rem" }}
            onClick={() => {
              setCategory(c.id);
              setWithPartner(c.needsPartner);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <PersonFields title="👤 내 정보" value={me} onChange={setMe} />

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={withPartner}
          onChange={(e) => setWithPartner(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        <span style={{ color: "var(--text)" }}>그 사람 정보도 넣기 (속궁합 정확도 ↑)</span>
      </label>

      {withPartner && <PersonFields title="💕 그 사람 정보" value={partner} onChange={setPartner} />}

      <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={loading}>
        {loading ? "사주 푸는 중… 🔮" : user ? "무료 미리보기 보기 →" : "3초 가입하고 무료 미리보기 보기 →"}
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
                  <h2>목차별 핵심 약 10문장을 먼저 보여드려요</h2>
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
                <button className="btn" onClick={() => setShowPay(true)} disabled={paying}>
                  {paying ? "해금 중…" : `전문 보기 — ${result.price.toLocaleString()}원`}
                </button>
                <p>점집 1회 5만원보다 가볍게, 한 번 결제로 계속 보관</p>
              </div>
            </div>
          )}

          {!full && (
            <div className="referral-reward-card">
              <span className="badge">친구 초대 보상</span>
              <h2>친구가 가입하면, 결제 대신 보상으로 열 수 있어요</h2>
              <p>친구 한 명이 내 링크로 가입하면 원하는 보상 하나가 자동 지급됩니다.</p>
              <div className="referral-reward-options">
                <button onClick={() => void shareReward("reading_unlock")}>
                  <strong>이 리딩 0원으로 열기</strong>
                  <span>친구 1명 가입 시 전문 무료</span>
                </button>
                <button onClick={() => void shareReward("chat_credits")}>
                  <strong>캐릭터챗 질문권 10장</strong>
                  <span>친구 1명 가입 시 바로 적립</span>
                </button>
              </div>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={checkReferralUnlock} disabled={checkingReward}>
                {checkingReward ? "친구 가입 확인 중…" : "공유했다면 보상 확인하기"}
              </button>
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
            setReferralStatus(
              u.referralCode
                ? { referralCode: u.referralCode, chatCredits: u.chatCredits ?? 0, readingUnlocked: false }
                : null
            );
            void generateReading(u);
          }}
          reason="무료 사주 미리보기를 저장하려면 3초 가입이 필요해요"
          onClose={() => setShowSignup(false)}
        />
      )}

      {showPay && result && (
        <PaymentModal
          price={result.price}
          depositorCode={depositorCode}
          paying={paying}
          onDone={confirmTransfer}
          onClose={() => setShowPay(false)}
        />
      )}
    </main>
  );
}
