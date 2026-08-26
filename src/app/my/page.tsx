"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listArchive, removeFromArchive, type ArchiveEntry } from "@/lib/archive";
import BrandMark from "@/components/BrandMark";
import SignupModal from "@/components/SignupModal";
import { getUser, saveUser, type User } from "@/lib/user";
import {
  COUPON_LABEL,
  couponHeadline,
  couponMeaning,
  type Coupon,
  type CouponState,
} from "@/lib/coupons";
import "../coupons.css";

// 계정으로 묶인 리딩 — 이 기기의 보관함에는 없지만 DB 에는 있는 것.
// 폰으로 결제하고 PC 에서 연 사람이 여기서 자기 리딩을 다시 만난다.
interface ServerReading {
  readingId: string;
  label: string;
  teaser: string;
  unlocked: boolean;
  createdAt: string;
}

type CouponRow = Coupon & { state: CouponState };

const STATE_LABEL: Record<CouponState, string> = {
  available: "사용 가능",
  reserved: "결제 대기",
  used: "사용함",
  expired: "기간 만료",
};

// 보관함은 목록만 담당한다. 리딩 본문·해금·추가 상담은 기사 페이지(/reading/[id])에서 처리한다.
// 로그인해야 열린다 (2026-08-26) — 쿠폰함이 여기 같이 있고, 쿠폰은 계정의 것이다.
export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [serverRows, setServerRows] = useState<ServerReading[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  const load = useCallback(
    (account: User) => {
      const archived = listArchive();
      setEntries(archived);

      // 계정에 묶인 리딩을 DB 에서도 가져와, 이 기기 보관함에 없는 것만 밑에 잇는다.
      // 못 가져와도 그냥 지나간다 — 로컬 보관함은 그대로 쓸 수 있어야 한다.
      const post = (path: string) =>
        fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: account.token }),
        });
      post("/api/my-readings")
        .then((res) => (res.ok ? res.json() : { readings: [] }))
        .then((data: { readings?: ServerReading[] }) => {
          const localIds = new Set(archived.map((entry) => entry.readingId));
          setServerRows((data.readings ?? []).filter((row) => !localIds.has(row.readingId)));
        })
        .catch(() => {});
      post("/api/coupons")
        .then((res) => (res.ok ? res.json() : { coupons: [] }))
        .then((data: { coupons?: CouponRow[] }) => setCoupons(data.coupons ?? []))
        .catch(() => {});
      // 초대 링크에 쓸 추천 코드. 로그인 직후에는 아직 기기에 없을 수 있다.
      post("/api/referral/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((status: { referralCode?: string; chatCredits?: number } | null) => {
          if (!status) return;
          const next = { ...account, referralCode: status.referralCode, chatCredits: status.chatCredits };
          setUser(next);
          saveUser(next);
        })
        .catch(() => {});
    },
    []
  );

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    setChecked(true);

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("open");
    const approved = params.get("payment") === "approved";
    setPaymentApproved(approved);
    // 결제/승인 화면에서 넘어온 열기 요청은 곧장 그 리딩 기사로 보낸다
    if (requested && listArchive().some((entry) => entry.readingId === requested)) {
      router.replace(`/reading/${requested}${approved ? "?payment=approved" : ""}`);
      return;
    }
    if (stored) load(stored);
  }, [router, load]);

  const remove = (readingId: string) => {
    if (!window.confirm("이 리딩을 보관함에서 삭제할까요?")) return;
    removeFromArchive(readingId);
    setEntries(listArchive());
  };

  const share = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=chat_credits`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 5,000원 쿠폰과 질문권 10장이 들어와요.");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNotice("초대 링크를 복사했어요.");
      }
    } catch {
      setShareNotice("");
    }
  };

  // 로컬 저장소를 읽기 전에는 아무것도 그리지 않는다 — 관문이 깜빡이며 지나가지 않게.
  if (!checked) return <main className="container" style={{ paddingTop: 48 }} />;

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <h1 style={{ marginBottom: 6 }}>📜 내 상담</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
          받은 리딩과 쿠폰함은 계정에 묶여 있어요.
        </p>
        <div className="card my-login-gate">
          <div style={{ display: "flex", justifyContent: "center" }}><BrandMark size={52} /></div>
          <p>로그인하면 이 기기와 다른 기기에서 받은 리딩, 그리고 쿠폰함이 열려요.</p>
          <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>
            로그인 · 가입하기
          </button>
          <Link href="/reading" className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }}>
            로그인 없이 무료 사주 먼저 보기 →
          </Link>
        </div>
        {showSignup && (
          <SignupModal
            reason="내 상담과 쿠폰함을 보려면 로그인이 필요해요"
            onDone={(next) => {
              setUser(next);
              setShowSignup(false);
              load(next);
            }}
            onClose={() => setShowSignup(false)}
          />
        )}
      </main>
    );
  }

  const usable = coupons.filter((coupon) => coupon.state === "available").length;

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 6 }}>📜 내 상담</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 18 }}>
        받은 리딩이 자동으로 보관됩니다. 다른 기기에서 받은 리딩도 함께 보여요.
      </p>
      <Link href="/reading" className="btn" style={{ width: "100%", marginBottom: 6 }}>
        새 사주 보기 →
      </Link>

      {paymentApproved && (
        <div className="card" style={{ margin: "16px 0", borderColor: "var(--accent)", background: "var(--bg-card2)" }}>
          <strong style={{ color: "var(--accent-soft)" }}>✓ 입금 확인이 완료됐어요</strong>
          <p style={{ marginTop: 4, fontSize: "0.84rem", color: "var(--text-dim)" }}>
            승인된 풀 리딩을 바로 열어두었습니다.
          </p>
        </div>
      )}

      <div className="my-section-title">
        <h2>🎟️ 쿠폰함</h2>
        <small>{usable > 0 ? `쓸 수 있는 쿠폰 ${usable}장` : "결제창에서 자동으로 적용돼요"}</small>
      </div>
      {coupons.length === 0 ? (
        <div className="coupon-empty">
          아직 쿠폰이 없어요. 친구가 내 링크로 가입하면 5,000원 쿠폰이 들어와요.
        </div>
      ) : (
        <div className="coupon-list">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="coupon-card" data-state={coupon.state}>
              <span className="coupon-amount">{couponHeadline(coupon)}</span>
              <span className="coupon-copy">
                <strong>{COUPON_LABEL[coupon.kind]}</strong>
                <span>
                  {coupon.state === "used"
                    ? "사용한 쿠폰이에요"
                    : `${new Date(coupon.expiresAt).toLocaleDateString("ko-KR")}까지 · ${couponMeaning(coupon)}`}
                </span>
              </span>
              <em className={`coupon-state${coupon.state === "available" ? " on" : ""}`}>
                {STATE_LABEL[coupon.state]}
              </em>
            </div>
          ))}
        </div>
      )}
      <button
        className="btn btn-ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={share}
        disabled={!user.referralCode}
      >
        친구 초대하고 5,000원 쿠폰 받기
      </button>
      {shareNotice && (
        <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 8 }}>{shareNotice}</p>
      )}

      <div className="my-section-title">
        <h2>🔮 받은 리딩</h2>
      </div>

      {entries.length === 0 && serverRows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><BrandMark size={52} /></div>
          <p style={{ marginBottom: 16 }}>아직 받은 리딩이 없어요.</p>
          <Link href="/reading" className="btn">첫 리딩 받으러 가기 →</Link>
        </div>
      )}

      <div className="archive-list">
        {entries.map((entry) => (
          <div key={entry.readingId} className="archive-row">
            <Link href={`/reading/${entry.readingId}`} className="archive-link">
              <span className="archive-icon" aria-hidden>🔮</span>
              <span className="archive-copy">
                <span className="archive-title">
                  <strong>{entry.label}</strong>
                  {entry.full ? (
                    <em className="on">해금됨</em>
                  ) : entry.pendingOrderId ? (
                    <em className="pending">승인 대기</em>
                  ) : (
                    <em>티저만</em>
                  )}
                </span>
                <span className="archive-excerpt">
                  {new Date(entry.createdAt).toLocaleDateString("ko-KR")} · {entry.teaser}
                </span>
              </span>
              <span className="archive-arrow" aria-hidden>›</span>
            </Link>
            <button type="button" className="archive-remove" onClick={() => remove(entry.readingId)}>
              삭제
            </button>
          </div>
        ))}
        {/* 다른 기기에서 받은 리딩. 열면 /reading/[id] 가 DB 에서 복원해 이 기기
            보관함에도 앉힌다 — 그래서 다음 방문부터는 위 목록으로 올라간다.
            삭제 버튼이 없는 것은 의도다. 로컬 보관함에서 지우는 버튼인데 이건
            로컬에 없는 것이라 지울 것도 없다. */}
        {serverRows.map((row) => (
          <div key={row.readingId} className="archive-row">
            <Link href={`/reading/${row.readingId}`} className="archive-link">
              <span className="archive-icon" aria-hidden>🔮</span>
              <span className="archive-copy">
                <span className="archive-title">
                  <strong>{row.label}</strong>
                  {row.unlocked ? <em className="on">해금됨</em> : <em>티저만</em>}
                </span>
                <span className="archive-excerpt">
                  {new Date(row.createdAt).toLocaleDateString("ko-KR")} · {row.teaser}
                </span>
              </span>
              <span className="archive-arrow" aria-hidden>›</span>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
