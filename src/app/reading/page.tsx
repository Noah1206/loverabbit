"use client";

import { useEffect, useState } from "react";
import PaymentModal from "@/components/PaymentModal";
import ChatSection from "@/components/ChatSection";
import SignupModal from "@/components/SignupModal";
import { saveToArchive, updateArchive } from "@/lib/archive";
import { getUser, type User } from "@/lib/user";

const MEMBERSHIP_KEY = "loverabbit_membership_v1";

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

// 결제 전 블러 뒤에 깔아두는 미끼 텍스트 — 실제 풀 리딩은 해금 전엔 서버 밖으로 안 나온다
const LOCKED_PLACEHOLDER = `■ 너의 밤 기질
네 일주를 보면 겉으로 드러나는 것과 속에서 움직이는 게 완전히 다른 구조야. 특히 상대가 어떤 사람이냐에 따라 …

■ 그 사람과의 합
이 조합에서 주도권이 어느 쪽에 있는지 명확하게 보여. 문제는 그걸 상대도 알고 있다는 건데 …

■ 위험 구간
올해 흐름에서 딱 한 번, 관계가 크게 흔들리는 시기가 와. 그 시기가 …

■ 지금 움직이는 법
지금 네가 하려는 행동, 그거 하면 안 돼. 대신 …`;

interface PersonForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: string;
}

const emptyPerson: PersonForm = { year: "", month: "", day: "", hour: "unknown", gender: "F" };

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
  const [result, setResult] = useState<{
    readingId: string;
    teaser: string;
    chart: { me: string; partner: string | null };
    price: number;
    blob: string; // 암호화된 풀 리딩 — 서버만 열 수 있음
    preview?: string; // 풀 리딩 실제 도입부 (블러 미끼)
    scoreLabel?: string | null; // 지수 이름 — 값은 해금 후 공개
    demo: boolean;
  } | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [membership, setMembership] = useState<{ token: string; expiresAt: number } | null>(null);

  // 홈 상품 카드에서 ?c= 로 진입하면 해당 카테고리를 자동 선택 + 멤버십 확인
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    const found = CATEGORIES.find((x) => x.id === c);
    if (found) {
      setCategory(found.id);
      setWithPartner(found.needsPartner);
    }
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBERSHIP_KEY) ?? "null");
      if (saved?.expiresAt > Date.now()) setMembership(saved);
    } catch {}
    setUser(getUser());
  }, []);

  // 멤버십 보유 시: 결제창 없이 서버가 토큰을 검증하고 바로 해금
  const unlockWithMembership = async () => {
    if (!result || !membership) return;
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: result.readingId,
          blob: result.blob,
          method: "membership",
          membershipToken: membership.token,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          localStorage.removeItem(MEMBERSHIP_KEY);
          setMembership(null);
        }
        throw new Error((await res.json()).error ?? "해금 실패");
      }
      const data = await res.json();
      setFull(data.full);
      setScore(data.score ?? null);
      updateArchive(result.readingId, { full: data.full });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!me.year || !me.month || !me.day) {
      setError("본인 생년월일을 입력해주세요.");
      return;
    }
    const myErr = birthError(me, "내");
    if (myErr) {
      setError(myErr);
      return;
    }
    if (withPartner && partner.year) {
      const pErr = birthError(partner, "그 사람");
      if (pErr) {
        setError(pErr);
        return;
      }
    }
    setLoading(true);
    setResult(null);
    setFull(null);
    setScore(null);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          me: parsePerson(me),
          partner: withPartner && partner.year ? parsePerson(partner) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "리딩 생성 실패");
      const data = await res.json();
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

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 6 }}>🐰 밤의 리딩</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 28 }}>
        어디 가서 못 물어보는 질문, 여기서 해결하세요.
      </p>

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
        {loading ? "사주 푸는 중… 🔮" : "무료 리딩 받기 →"}
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
            <span className="badge" style={{ marginBottom: 10 }}>무료 티저</span>
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

          <div className="card" style={{ position: "relative", overflow: "hidden" }}>
            <span className="badge" style={{ marginBottom: 10 }}>{full ? "🔓 풀 리딩" : "🔒 풀 리딩"}</span>
            <div className={full ? "" : "blur-lock"} style={{ marginTop: 10 }}>
              {/* 잠금 상태에서는 실제 풀 리딩의 도입부만 살짝 보여주고 블러 */}
              <p style={{ whiteSpace: "pre-wrap" }}>
                {full ?? `${result.preview ? result.preview + "…\n\n" : ""}${LOCKED_PLACEHOLDER}`}
              </p>
            </div>
            {!full && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  background: "linear-gradient(180deg, transparent, var(--bg) 45%)",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <p style={{ fontWeight: 700 }}>뒷이야기가 더 아찔합니다 🔥</p>
                {membership ? (
                  <button className="btn" onClick={unlockWithMembership} disabled={paying}>
                    {paying ? "해금 중…" : "멤버십으로 무료 열기 🌙"}
                  </button>
                ) : (
                  // 미가입자는 회원가입 → 결제 순서로 (무료 티저까지는 가입 불필요)
                  <button className="btn" onClick={() => (user ? setShowPay(true) : setShowSignup(true))} disabled={paying}>
                    {paying ? "해금 중…" : user ? `풀 리딩 해금 — ${result.price.toLocaleString()}원` : `가입하고 풀 리딩 열기 — ${result.price.toLocaleString()}원`}
                  </button>
                )}
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  {membership
                    ? `멤버십 이용 중 · ${new Date(membership.expiresAt).toLocaleDateString("ko-KR")}까지 무제한`
                    : `점집 1회 5만원 vs 러브레빗 ${result.price.toLocaleString()}원`}
                </p>
              </div>
            )}
          </div>

          {full && (
            <ChatSection
              readingId={result.readingId}
              blob={result.blob}
              membershipToken={membership?.token ?? null}
            />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => downloadShareImage(result.teaser)}
            >
              📸 공유 이미지 저장
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => {
                navigator.clipboard.writeText(
                  `🐰 러브레빗이 나한테 한 말:\n\n"${result.teaser}"\n\n너도 해봐 → https://loverabbit.example.com`
                );
                alert("복사됐어요! 친구한테 공유해보세요 😏");
              }}
            >
              🔗 텍스트 복사
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
            setShowPay(true); // 가입 완료 → 바로 결제로 이어짐
          }}
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
