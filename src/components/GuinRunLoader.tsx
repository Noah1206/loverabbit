// 지도를 만드는 동안의 화면 — 로고 토끼가 실제 프레임 애니메이션으로 달린다.
// 세 프레임(움츠림→도약→착지)을 순환시키며 트랙을 가로지른다.
// 낭독기는 문구로 안다(role=status). reduced-motion 이면 멈춰 서 있는다.
export default function GuinRunLoader({ label = "지도를 그리는 중…" }: { label?: string }) {
  return (
    <div className="guin-run" role="status" aria-live="polite">
      <div className="guin-run-track" aria-hidden>
        <span className="guin-run-sprite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/guin-map/run-1.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/guin-map/run-2.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/guin-map/run-3.png" alt="" />
        </span>
      </div>
      <p>{label}</p>
    </div>
  );
}
