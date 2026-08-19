// 법정 기재사항 — 한 곳에서만 관리한다.
//
// 전자상거래법 제10조(사업자의 신원 등 표시)는 상호·대표자·영업소 주소·전화번호·
// 전자우편주소·사업자등록번호·통신판매업 신고번호를 표시하도록 하고,
// 개인정보보호법 제30조는 개인정보 보호책임자의 성명·직책·연락처를 처리방침에
// 싣도록 한다. 두 묶음을 여기서 함께 들고 있는다.
//
// 값은 배포 환경변수에서 읽는다. 대표자 이름·영업소 주소·전화번호는 개인정보에
// 해당하므로 공개 저장소에 커밋하지 않는다. 채우는 곳은 .env.example 참고.
// (NEXT_PUBLIC_ 접두사가 붙은 값은 브라우저 번들에 들어간다. 어차피 화면에
//  공개할 항목들이라 문제없지만, 비밀값을 여기 얹지는 말 것.)

const read = (value: string | undefined): string => value?.trim() ?? "";

export interface LegalField {
  /** 화면에 찍히는 항목 이름 */
  label: string;
  value: string;
  /** 전화·메일처럼 바로 걸 수 있는 항목 */
  href?: string;
  /** 법이 요구하는 항목인지 — 비어 있으면 경고 대상이 된다 */
  required: boolean;
}

const email = read(process.env.NEXT_PUBLIC_BUSINESS_EMAIL);
const phone = read(process.env.NEXT_PUBLIC_BUSINESS_PHONE);

export const BUSINESS = {
  /** 서비스명 — 상호와 다를 수 있어 따로 둔다 */
  serviceName: "러브레빗(LoveRabbit)",
  name: read(process.env.NEXT_PUBLIC_BUSINESS_NAME),
  representative: read(process.env.NEXT_PUBLIC_BUSINESS_REPRESENTATIVE),
  address: read(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS),
  registrationNo: read(process.env.NEXT_PUBLIC_BUSINESS_REGISTRATION_NO),
  mailOrderNo: read(process.env.NEXT_PUBLIC_BUSINESS_MAIL_ORDER_NO),
  /** 통신판매업 신고를 받은 지자체 — 신고번호와 함께 적는다 */
  mailOrderAuthority: read(process.env.NEXT_PUBLIC_BUSINESS_MAIL_ORDER_AUTHORITY),
  phone,
  email,
  /** 사이버몰 호스팅 제공자. 이 서비스는 Vercel에 올라간다. */
  hosting: read(process.env.NEXT_PUBLIC_HOSTING_PROVIDER) || "Vercel Inc.",
  privacyOfficer: {
    name: read(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_NAME),
    title: read(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_TITLE) || "개인정보 보호책임자",
    // 따로 두지 않았으면 대표 연락처를 그대로 쓴다.
    email: read(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL) || email,
    phone: read(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_PHONE) || phone,
  },
} as const;

/** 전자상거래법 제10조가 요구하는 사업자 신원 항목 */
export function businessFields(): LegalField[] {
  const mailOrder = BUSINESS.mailOrderAuthority
    ? `${BUSINESS.mailOrderNo} (신고기관: ${BUSINESS.mailOrderAuthority})`
    : BUSINESS.mailOrderNo;

  return [
    { label: "상호", value: BUSINESS.name, required: true },
    { label: "대표자", value: BUSINESS.representative, required: true },
    { label: "사업자등록번호", value: BUSINESS.registrationNo, required: true },
    { label: "통신판매업 신고번호", value: BUSINESS.mailOrderNo ? mailOrder : "", required: true },
    { label: "영업소 소재지", value: BUSINESS.address, required: true },
    {
      label: "전화번호",
      value: BUSINESS.phone,
      href: BUSINESS.phone ? `tel:${BUSINESS.phone.replace(/[^0-9+]/g, "")}` : undefined,
      required: true,
    },
    {
      label: "전자우편주소",
      value: BUSINESS.email,
      href: BUSINESS.email ? `mailto:${BUSINESS.email}` : undefined,
      required: true,
    },
    { label: "호스팅 제공자", value: BUSINESS.hosting, required: false },
  ];
}

/** 개인정보보호법 제30조가 요구하는 보호책임자 항목 */
export function privacyOfficerFields(): LegalField[] {
  const officer = BUSINESS.privacyOfficer;
  return [
    { label: "성명", value: officer.name, required: true },
    { label: "직책", value: officer.title, required: true },
    {
      label: "전자우편주소",
      value: officer.email,
      href: officer.email ? `mailto:${officer.email}` : undefined,
      required: true,
    },
    {
      label: "전화번호",
      value: officer.phone,
      href: officer.phone ? `tel:${officer.phone.replace(/[^0-9+]/g, "")}` : undefined,
      required: true,
    },
  ];
}

/** 아직 안 채워진 필수 항목. 비어 있어야 정상 배포다. */
export function missingLegalFields(): string[] {
  const pick = (group: string, fields: LegalField[]) =>
    fields.filter((field) => field.required && !field.value).map((field) => `${group} ${field.label}`);

  return [...pick("사업자", businessFields()), ...pick("보호책임자", privacyOfficerFields())];
}
