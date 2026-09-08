import type { GenreId } from "@/lib/genres";

/**
 * 종목 아이콘 — 선으로만 그린 24 격자.
 *
 * 캐릭터 그림을 쓰다 걷었다 (2026-09-08 운영자). 종목 여섯에 얼굴 여섯이
 * 서면 한 화면에 캐릭터가 여덟 마리가 된다(배너 둘 포함) — 캐릭터가 흔해지면
 * 대표 캐릭터의 무게도 같이 떨어진다.
 *
 * 얼굴은 자리를 아껴 쓴다: 배너와 띠 표식처럼 **한 명을 크게** 세우는 자리에만
 * 둔다. 목록과 격자는 선 아이콘 쪽이 훑기에도 낫다.
 *
 * stroke 폭과 격자는 BottomNav 의 것과 맞췄다 — 같은 화면에 두 문법이 서면
 * 어느 쪽도 정돈돼 보이지 않는다.
 */
export default function GenreIcon({ id, size = 26 }: { id: GenreId; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    // 사주 — 여덟 글자가 네 기둥에 선 모양
    case "saju":
      return (
        <svg {...common}>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
          <path d="M12 4v16M3.5 12h17" />
          <circle cx="7.75" cy="8" r="1.1" />
          <circle cx="16.25" cy="16" r="1.1" />
        </svg>
      );

    // 타로 — 겹친 카드 두 장
    case "tarot":
      return (
        <svg {...common}>
          <rect x="8.5" y="3.5" width="11" height="15" rx="2" />
          <path d="M6 6.5 4.7 7a2 2 0 0 0-1.2 2.5l3 9a2 2 0 0 0 2.5 1.3l4.5-1.5" />
          <path d="M14 8.5v5M11.5 11h5" />
        </svg>
      );

    // 궁합 — 겹친 두 원
    case "gunghap":
      return (
        <svg {...common}>
          <circle cx="9" cy="12" r="5.5" />
          <circle cx="15" cy="12" r="5.5" />
        </svg>
      );

    // 주간·월간 — 달력
    case "period":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
          <circle cx="8.5" cy="14.5" r="1.1" />
          <circle cx="12" cy="14.5" r="1.1" />
        </svg>
      );

    // 사주지도 — 가운데와 둘레를 이은 관계 지도
    case "map":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.6" />
          <circle cx="12" cy="4.6" r="1.8" />
          <circle cx="18.4" cy="15.7" r="1.8" />
          <circle cx="5.6" cy="15.7" r="1.8" />
          <path d="M12 6.4v3M13.9 13.4l2.9 1.6M10.1 13.4l-2.9 1.6" />
        </svg>
      );

    // 만세력 — 펼친 책
    case "manseryeok":
      return (
        <svg {...common}>
          <path d="M12 6.5S10 4.5 4.5 4.5v13C10 17.5 12 19.5 12 19.5s2-2 7.5-2v-13C14 4.5 12 6.5 12 6.5Z" />
          <path d="M12 6.5v13" />
        </svg>
      );
  }
}
