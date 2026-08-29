import Link from "next/link";

// 없는 주소.
//
// 이 파일이 없으면 Next 의 기본 404 가 뜬다 - 흰 바탕에 검은 영문 한 줄. 앱의
// 다른 화면과 같은 옷을 입지 않은 유일한 화면이 되고, 그건 대개 광고 링크가
// 잘못됐을 때 사람들이 처음 보는 화면이다.

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h1>이 주소에는 아무것도 없어요</h1>
        <p>링크가 바뀌었거나, 주소가 잘못 적혔을 수 있어요.</p>
        <Link href="/" className="btn">
          홈으로
        </Link>
      </section>
    </main>
  );
}
