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

const telHref = (value: string) => (value ? `tel:${value.replace(/[^0-9+]/g, "")}` : undefined);
const mailHref = (value: string) => (value ? `mailto:${value}` : undefined);

/** 값이 들어온 항목만 남긴다 — 안 채운 줄이 화면에 남지 않게. */
const filled = (fields: LegalField[]) => fields.filter((field) => field.value);

// 통신판매업은 신고번호와 신고기관이 한 줄로 붙는다. 둘 중 하나만 있을 수도
// 있으므로 있는 쪽에 맞춰 이름과 값을 정한다.
function mailOrderField(): LegalField {
  const { mailOrderNo: no, mailOrderAuthority: authority } = BUSINESS;
  if (no && authority) {
    return { label: "통신판매업 신고번호", value: `${no} (신고기관: ${authority})`, required: true };
  }
  if (no) return { label: "통신판매업 신고번호", value: no, required: true };
  return { label: "통신판매업 신고기관", value: authority, required: true };
}

/** 전자상거래법 제10조가 요구하는 사업자 신원 항목 */
export function businessFields(): LegalField[] {
  return filled([
    { label: "상호", value: BUSINESS.name, required: true },
    { label: "대표자", value: BUSINESS.representative, required: true },
    { label: "사업자등록번호", value: BUSINESS.registrationNo, required: true },
    mailOrderField(),
    { label: "영업소 소재지", value: BUSINESS.address, required: true },
    { label: "전화번호", value: BUSINESS.phone, href: telHref(BUSINESS.phone), required: true },
    { label: "전자우편주소", value: BUSINESS.email, href: mailHref(BUSINESS.email), required: true },
    { label: "호스팅 제공자", value: BUSINESS.hosting, required: false },
  ]);
}

/** 개인정보보호법 제30조가 요구하는 보호책임자 항목 */
export function privacyOfficerFields(): LegalField[] {
  const officer = BUSINESS.privacyOfficer;
  // 이름도 연락처도 없으면 직책만 덩그러니 남으므로 통째로 접는다.
  if (!officer.name && !officer.email && !officer.phone) return [];

  return filled([
    { label: "성명", value: officer.name, required: true },
    { label: "직책", value: officer.title, required: true },
    { label: "전자우편주소", value: officer.email, href: mailHref(officer.email), required: true },
    { label: "전화번호", value: officer.phone, href: telHref(officer.phone), required: true },
  ]);
}

/**
 * 아직 안 채워진 필수 항목. 화면에는 안 나오지만 개발 빌드에서 목록으로 보여준다.
 * 유료 결제를 받는 이상 이 배열은 비어 있어야 한다.
 */
export function missingLegalFields(): string[] {
  const present = new Set([
    ...businessFields().map((field) => field.label),
    ...privacyOfficerFields().map((field) => `보호책임자 ${field.label}`),
  ]);
  const wanted = [
    "상호",
    "대표자",
    "사업자등록번호",
    "통신판매업 신고번호",
    "영업소 소재지",
    "전화번호",
    "전자우편주소",
    "보호책임자 성명",
    "보호책임자 전자우편주소",
  ];
  return wanted.filter((label) => !present.has(label));
}
