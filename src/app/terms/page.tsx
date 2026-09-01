import type { Metadata } from "next";
import Link from "next/link";

import LegalFieldList from "@/components/LegalFieldList";
import { BUSINESS, businessFields, missingLegalFields } from "@/lib/business-info";
import { KRW_PER_CREDIT, QUESTION_COST, READING_SALE_CREDITS } from "@/lib/credits";
import { WEBTOON_FORTUNE_CONFIG } from "@/lib/webtoon-saju";

/*
  이용약관 — 결제가 있는 서비스가 반드시 걸어야 하는 문서.

  전자상거래법은 청약철회의 기간과 예외를, 콘텐츠 상품은 "언제부터 환불이
  안 되는가"를 미리 밝히기를 요구한다. 우리 상품은 결제하는 순간 글을 만들기
  시작하므로(reading-gate.ts) 그 시점이 곧 이용 개시 시점이다 — 그 사실을
  약관에 적어 두지 않으면 나중에 말이 달라진다.

  가격은 상수에서 직접 읽는다. 문서에 숫자를 손으로 박아 두면 값이 바뀌는 날
  약관만 옛말이 된다.
*/

export const metadata: Metadata = {
  title: "이용약관 — 러브레빗",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const missing = missingLegalFields();
  const business = businessFields();
  const webtoonCost = WEBTOON_FORTUNE_CONFIG.money.unlockCost;

  return (
    <main className="lp lp-doc">
      <h1 className="lp-h1">이용약관</h1>
      <p className="lp-note">최종 개정일: 2026-09-01</p>

      {process.env.NODE_ENV !== "production" && missing.length > 0 ? (
        // 운영자에게만 보이는 체크리스트. 배포 빌드에는 들어가지 않는다.
        <p className="legal-todo">
          아직 안 채운 법정 기재사항 {missing.length}건 — {missing.join(", ")}. 배포 환경변수의
          NEXT_PUBLIC_BUSINESS_* 를 채우세요.
        </p>
      ) : null}

      <section className="lp-doc-section">
        <h2 className="lp-h2">1. 목적과 적용</h2>
        <p>
          이 약관은 {BUSINESS.serviceName}(이하 &ldquo;서비스&rdquo;)이 제공하는 사주 리딩·질문·웹툰
          사주 등 콘텐츠의 이용 조건을 정합니다. 서비스를 이용하면 이 약관에 동의한 것으로 봅니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">2. 서비스의 성격</h2>
        <p>
          <strong>
            서비스가 제공하는 모든 해석은 전통 명리 이론을 바탕으로 한 오락·자기성찰용 콘텐츠입니다.
          </strong>{" "}
          미래를 확정하거나 보장하지 않으며, 의료·법률·금융·투자 판단의 근거로 삼을 수 없습니다.
          중요한 결정은 해당 분야 전문가와 상의해 주세요.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">3. 회원가입과 계정</h2>
        <p>
          소셜 로그인으로 가입합니다. 만 14세 미만은 이용할 수 없습니다. 계정과 그에 담긴 리딩은
          본인만 열람할 수 있으며, 계정 정보를 타인과 공유해 생긴 손해에는 책임지지 않습니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">4. 유료 서비스와 결제</h2>
        <p>
          서비스의 결제 단위는 &ldquo;러빗&rdquo;입니다. {KRW_PER_CREDIT}원이 1러빗이며, 러빗은
          결제 후 계정에 적립됩니다.
        </p>
        <ul className="lp-doc-list">
          <li>사주 리딩 전문 열람 — {READING_SALE_CREDITS}러빗</li>
          <li>웹툰 사주 상세 — 운세 1종당 {webtoonCost}러빗</li>
          <li>오늘의 질문 — 1회 {QUESTION_COST}러빗</li>
        </ul>
        <p>
          가격은 변경될 수 있으며, 변경 시 결제 화면에 표시된 금액이 적용됩니다. 이미 적립된 러빗의
          가치는 변경되지 않습니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">5. 청약철회와 환불</h2>
        <p>
          <strong>사용하지 않은 러빗</strong>은 결제일로부터 7일 이내에 환불을 요청할 수 있습니다.
          앱 안의 문의하기로 접수해 주세요.
        </p>
        <p>
          <strong>이미 열람한 콘텐츠는 환불되지 않습니다.</strong> 사주 리딩·웹툰 사주·질문의 답변은
          러빗을 사용하는 순간 이용자만을 위해 생성되며, 생성과 동시에 이용이 시작되기 때문입니다
          (전자상거래법 제17조 제2항 제5호 — 복제가 가능한 재화의 포장을 훼손한 경우에 준함).
          결제 화면에서 이 점을 다시 안내합니다.
        </p>
        <p>
          다만 아래의 경우에는 열람 여부와 무관하게 러빗을 돌려드리거나 환불합니다.
        </p>
        <ul className="lp-doc-list">
          <li>서비스 오류로 결과가 생성되지 않은 경우</li>
          <li>결제는 되었으나 콘텐츠가 제공되지 않은 경우</li>
          <li>표시된 내용과 명백히 다른 콘텐츠가 제공된 경우</li>
        </ul>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">6. 이용자의 의무</h2>
        <ul className="lp-doc-list">
          <li>타인의 생년월일 등 개인정보를 동의 없이 입력하지 않습니다</li>
          <li>서비스의 콘텐츠를 무단으로 복제·배포·판매하지 않습니다</li>
          <li>자동화된 수단으로 서비스에 과도한 부하를 주지 않습니다</li>
        </ul>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">7. 서비스의 변경과 중단</h2>
        <p>
          서비스는 내용을 개선하거나 일부 기능을 변경·중단할 수 있습니다. 유료 콘텐츠에 영향을 주는
          중단은 사전에 공지하며, 이미 결제한 러빗은 환불하거나 이용 기간을 보장합니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">8. 책임의 한계</h2>
        <p>
          서비스는 제2조에 따른 오락·자기성찰용 콘텐츠를 제공합니다. 이용자가 콘텐츠를 근거로 내린
          판단과 그 결과에 대해서는 책임지지 않습니다. 천재지변, 통신 장애 등 서비스가 통제할 수
          없는 사유로 인한 중단에도 책임이 면제됩니다.
        </p>
      </section>

      <section className="lp-doc-section">
        <h2 className="lp-h2">9. 문의와 분쟁</h2>
        <p>
          문의는 앱 안의 문의하기로 받습니다. 분쟁이 생기면 서로 성실히 협의하며, 협의가 되지 않을
          때는 관계 법령과 상관례에 따릅니다.
        </p>
        <p>
          개인정보의 처리에 관한 사항은 <Link href="/privacy">개인정보처리방침</Link>을 따릅니다.
        </p>
      </section>

      {business.length > 0 ? (
        <section className="lp-doc-section">
          <h2 className="lp-h2">10. 사업자 정보</h2>
          <LegalFieldList fields={business} />
        </section>
      ) : null}
    </main>
  );
}
