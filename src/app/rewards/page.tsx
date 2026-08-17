import Link from "next/link";

export default function RewardsPage() {
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>LOVE RABBIT REWARDS</p>
      <h1 style={{ marginBottom: 8 }}>선물함</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        참여 가능한 이벤트와 받을 수 있는 혜택을 모아두는 공간이에요.
      </p>
      <div className="card" style={{ textAlign: "center", padding: 36 }}>
        <p style={{ fontSize: "2.2rem", marginBottom: 10 }}>🎁</p>
        <strong style={{ display: "block", marginBottom: 8 }}>첫 번째 보상을 준비 중이에요</strong>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 18 }}>
          새로운 이벤트가 열리면 이곳에서 바로 확인할 수 있어요.
        </p>
        <Link href="/reading" className="btn">무료 리딩 시작하기 →</Link>
      </div>
    </main>
  );
}
