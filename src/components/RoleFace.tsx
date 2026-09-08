import { zodiacForRole } from "@/lib/zodiac-character";

/**
 * 관계 역할의 얼굴.
 *
 * 사주지도의 사람 목록은 색 점 하나로 역할을 갈랐다. 여덟이 늘어서면 색만으로는
 * 무엇이 무엇인지 안 갈리고, 색맹인 사람에게는 아예 안 갈린다 — 그래서 얼굴을
 * 세운다. 이름을 읽기 전에 생김새로 먼저 구분된다.
 *
 * **상대의 띠가 아니다.** 상대 생년월일은 봉인 저장이라 화면에 온 적이 없고
 * (guin-db.ts), 그 규칙은 그대로 둔다. 여기 서는 것은 계산된 **역할**에 붙인
 * 그림일 뿐이라 어떤 개인정보도 새로 꺼내지 않는다.
 *
 * 장식이므로 스크린리더에서는 숨긴다 — 역할 이름은 옆의 글자가 이미 말한다.
 */
export default function RoleFace({
  role,
  size = 30,
  className,
}: {
  role: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const z = zodiacForRole(role);
  if (!z) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      aria-hidden
      alt=""
      src={z.art}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ display: "inline-block", objectFit: "contain", flexShrink: 0 }}
    />
  );
}
