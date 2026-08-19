import type { Metadata } from "next";

// 개인정보처리방침 — 쿠키 동의 배너와 광고 심사에서 함께 요구되는 문서.
// 실제 사업자 정보·연락처는 운영자가 확인해 채워야 한다.

export const metadata: Metadata = {
  title: "개인정보처리방침 — 러브레빗",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="lp lp-doc">
      <h1 className="lp-h1">개인정보처리방침</h1>
      <p className="lp-note">최종 개정일: 2026-08-19</p>

      <section className="lp-doc-section">
        <h2 className="lp-h2">1. 수집하는 정보</h2>
        <p>
          서비스 제공을 위해 아래 정보를 수집합니다. 리딩 해석에 쓰이는 생년월일·출생시간 등의
          입력값은 결과 생성과 저장에만 사용합니다.
        </p>
        <ul className="lp-doc-list">
          <li>계정 정보 — 소셜 로그인 제공자가 전달하는 식별자</li>
          <li>리딩 입력값 — 생년월일, 출생시간, 관계 상황 선택지</li>
          <li>결제 정보 — 결제대행사가 처리하며, 카드번호는 저장하지 않습니다</li>
          <li>이용 기록 — 접속 기록, 기기·브라우저 정보</li>
        </ul>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">2. 광고 및 분석 쿠키</h2>
        <p>
          광고 성과 측정을 위해 Meta Pixel 및 전환 API를 사용합니다. <strong>이용자가 마케팅 쿠키에
          동의한 경우에만</strong> 작동하며, 동의 전에는 관련 스크립트가 로드되지 않습니다.
        </p>
        <p>
          광고 플랫폼으로는 전환이 일어났다는 사실과 금액·주문번호만 전송하며,
          <strong> 생년월일·출생시간·출생지·성별·상대방 정보·관계 상황 원문·사주 결과·결제수단
          정보는 전송하지 않습니다.</strong>
        </p>
        <p>동의는 브라우저에 저장되며, 저장 데이터를 삭제하면 다시 선택할 수 있습니다.</p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">3. 보유 및 파기</h2>
        <p>
          회원 탈퇴 시 계정 정보와 리딩 결과를 지체 없이 파기합니다. 다만 전자상거래법 등 관계 법령이
          정한 거래 기록은 해당 기간 동안 보관합니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">4. 이용자의 권리</h2>
        <p>
          이용자는 언제든지 자신의 정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 요청은 아래
          연락처로 받습니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">5. 문의</h2>
        <p>개인정보 보호책임자 및 문의처는 서비스 내 문의하기를 통해 확인할 수 있습니다.</p>
      </section>
    </main>
  );
}
