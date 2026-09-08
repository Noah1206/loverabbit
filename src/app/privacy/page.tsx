import type { Metadata } from "next";
import LegalFieldList from "@/components/LegalFieldList";
import {
  BUSINESS,
  businessFields,
  missingLegalFields,
  privacyOfficerFields,
} from "@/lib/business-info";

// 개인정보처리방침 — 쿠키 동의 배너와 광고 심사에서 함께 요구되는 문서.
// 사업자 신원(전자상거래법 제10조)과 개인정보 보호책임자(개인정보보호법 제30조)는
// src/lib/business-info.ts 한 곳에서 읽는다. 값은 배포 환경변수로 채운다.

export const metadata: Metadata = {
  title: "개인정보처리방침 — 러브레빗",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const missing = missingLegalFields();
  const officer = privacyOfficerFields();
  const business = businessFields();

  return (
    <main className="lp lp-doc">
      <h1 className="lp-h1">개인정보처리방침</h1>
      <p className="lp-note">최종 개정일: 2026-08-19</p>

      {process.env.NODE_ENV !== "production" && missing.length > 0 ? (
        // 운영자에게만 보이는 체크리스트. 배포 빌드에는 들어가지 않는다.
        <p className="legal-todo">
          아직 안 채운 법정 기재사항 {missing.length}건 — {missing.join(", ")}. 배포 환경변수의
          NEXT_PUBLIC_BUSINESS_* / NEXT_PUBLIC_PRIVACY_OFFICER_* 를 채우세요.
        </p>
      ) : null}

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
          <li>
            사주지도 입력값 — 이용자가 등록한 인연의 별명, 생년월일, 출생시간(선택)
          </li>
        </ul>

        {/* 2026-09-08 — 사주지도에서 이용자가 제3자의 정보를 입력할 수 있게 되면서
            더한 항목이다. 기능이 하는 일을 그대로 적는다. */}
        <p style={{ marginTop: 12 }}>
          <strong>사주지도의 제3자 정보 입력</strong>
        </p>
        <p>
          사주지도에서는 이용자가 주변 사람(인연)의 별명과 생년월일을 직접 입력할 수 있습니다.
          이 정보는 두 사람의 관계 계산에만 사용하며, 다음을 지킵니다.
        </p>
        <ul className="lp-doc-list">
          <li>실명 대신 별명 사용을 권장하며, 화면에는 입력한 별명만 표시됩니다</li>
          <li>생년월일과 출생시간은 암호화하여 보관하고 다른 이용자에게 공개하지 않습니다</li>
          <li>입력한 이용자가 언제든 해당 인연을 삭제할 수 있으며, 삭제 시 관계 기록도 함께 지워집니다</li>
          <li>
            본인이 아닌 사람의 정보를 입력할 때는 그 사람이 원하지 않을 경우 즉시 삭제해 주세요
          </li>
          <li>
            <strong>당사자는 직접 삭제할 수 있습니다.</strong> 공유받은 결과 화면의 &ldquo;내 정보를
            이 지도에서 지우고 싶어요&rdquo;에서 본인의 별명과 생년월일을 입력하면, 승인을 기다리지
            않고 그 자리에서 삭제됩니다. 확인에 쓴 입력값은 저장하지 않습니다
          </li>
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
          이용자는 언제든지 자신의 정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.{" "}
          <strong>탈퇴는 마이 화면에서 직접 할 수 있으며, 누르는 즉시 처리됩니다.</strong> 그 밖의
          요청은 앱 안의 문의하기{officer.length > 0 ? " 또는 아래 개인정보 보호책임자 연락처" : ""}로
          받으며, 접수일로부터 10일 이내에 처리 결과를 알려드립니다.
        </p>
      </section>

      {officer.length > 0 ? (
        <section className="lp-doc-section">
          <h2 className="lp-h2">5. 개인정보 보호책임자</h2>
          <p>
            개인정보 처리에 관한 업무를 총괄하고, 이용자의 문의·불만·피해구제를 아래 책임자가
            처리합니다.
          </p>
          <LegalFieldList fields={officer} />
        </section>
      ) : null}

      {business.length > 0 ? (
        <section className="lp-doc-section">
          <h2 className="lp-h2">{officer.length > 0 ? "6" : "5"}. 사업자 정보</h2>
          <p>{BUSINESS.serviceName} 서비스를 운영하는 사업자의 신원 정보입니다.</p>
          <LegalFieldList fields={business} />
        </section>
      ) : null}

      <section className="lp-doc-section">
        <h2 className="lp-h2">
          {5 + (officer.length > 0 ? 1 : 0) + (business.length > 0 ? 1 : 0)}. 권익침해 구제방법
        </h2>
        <p>
          개인정보 침해로 상담·피해구제가 필요하면 아래 기관에 문의할 수 있습니다. 위 연락처로
          받은 처리 결과에 만족하지 못한 경우에도 같습니다.
        </p>
        <ul className="lp-doc-list">
          <li>
            개인정보 분쟁조정위원회 — 1833-6972 /{" "}
            <a href="https://www.kopico.go.kr" target="_blank" rel="noreferrer noopener">
              kopico.go.kr
            </a>
          </li>
          <li>
            개인정보침해 신고센터 — 118 /{" "}
            <a href="https://privacy.kisa.or.kr" target="_blank" rel="noreferrer noopener">
              privacy.kisa.or.kr
            </a>
          </li>
          <li>대검찰청 사이버수사과 — 1301</li>
          <li>경찰청 사이버범죄 신고상담 — 182</li>
        </ul>
      </section>
    </main>
  );
}
