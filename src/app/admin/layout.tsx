import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "운영 관리 — LoveRabbit",
  robots: { index: false, follow: false },
};

/*
  관리자 화면은 노트북에서 본다.

  서비스 화면은 480px 폰 폭에 갇혀 있다(--app-max-width). 그 폭에 표를 넣으면
  숫자가 두 줄로 접히고, 표 세 개를 나란히 볼 수가 없어 위아래로 스크롤하며
  머릿속에서 맞춰야 했다. 운영자는 앉아서 보는 사람이라 폭을 열어 준다.

  변수 하나만 덮는다. 안쪽의 카드·표·버튼은 그대로 그 변수를 보고 있으므로,
  이 한 줄로 관리자 화면 전체가 넓어진다.
*/
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}
