// 지도를 만드는 동안의 화면 — 토끼가 발자국 길을 달린다.
// 스피너 대신 세계관으로 기다림을 채운다. 낭독기는 문구로 안다(role=status).
export default function GuinRunLoader({ label = "지도를 그리는 중…" }: { label?: string }) {
  return (
    <div className="guin-run" role="status" aria-live="polite">
      <div className="guin-run-track" aria-hidden>
        <span className="guin-run-rabbit">🐇</span>
      </div>
      <p>{label}</p>
    </div>
  );
}
