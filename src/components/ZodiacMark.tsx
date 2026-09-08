import { hasZodiacArt, zodiacOf } from "@/lib/zodiac-character";

/**
 * 띠 표식 — 그림이 있으면 그림, 없으면 이모지.
 *
 * 열두 장이 한꺼번에 오지 않아서 갈래가 필요하다. 아직 안 그린 띠에 그림을
 * 그대로 걸면 깨진 이미지 아이콘이 뜨는데, 그건 이모지보다 나쁘다. 어느 띠가
 * 준비됐는지는 zodiac-character.ts 의 ZODIAC_ART_READY 가 정한다 — 파일을
 * 넣고 그 집합에 이름을 더하면 이 컴포넌트가 저절로 그림으로 바뀐다.
 *
 * 장식이므로 스크린리더에서는 숨긴다. 띠 이름은 옆의 글자가 이미 말하고
 * 있어서, 여기서 또 읽으면 "토끼 토끼" 가 된다.
 */
export default function ZodiacMark({
  animal,
  size = 24,
  className,
}: {
  animal: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const z = zodiacOf(animal);
  if (!z) return null;

  if (!hasZodiacArt(animal)) {
    return (
      <span
        aria-hidden
        className={className}
        style={{ fontSize: size * 0.86, lineHeight: 1, display: "inline-block" }}
      >
        {z.emoji}
      </span>
    );
  }

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
      style={{ display: "inline-block", objectFit: "contain" }}
    />
  );
}
