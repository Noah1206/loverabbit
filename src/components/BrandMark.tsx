import Image from "next/image";
import loveRabbitLogo from "../../public/logo.png";

// 브랜드 마크 — 빈 상태·로그인·인증 화면에서 쓰던 🐰 이모지 자리표시자를 실제 로고로 대체한다.
// 로고 교체가 필요하면 public/logo.png 하나만 갈면 된다.
export default function BrandMark({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      className={className}
      src={loveRabbitLogo}
      // 옆에 항상 제목이 따라오는 장식 요소이므로 대체텍스트를 비운다.
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      style={{ display: "block" }}
    />
  );
}
