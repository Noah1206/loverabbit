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
    // 사주 — 음양(태극). 격자보다 이쪽이 무엇을 보는 곳인지 한눈에 말한다
    // (2026-09-09 운영자). 태극은 선 하나로 그려지지 않아 이 아이콘만 채움을
    // 쓴다 — 나머지는 stroke 그대로다.
    case "saju":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          {/* S 자 경계. 위 반원은 채우고 아래 반원은 비워 음양을 만든다 */}
          <path
            d="M12 3a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9 9 9 0 0 0 0-18Z"
            fill="currentColor"
            stroke="none"
          />
          <circle cx="12" cy="7.5" r="1.15" fill="none" />
          <circle cx="12" cy="16.5" r="1.15" fill="currentColor" stroke="none" />
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

    // 연예인 궁합 — 붉은 실로 묶인 두 자리 (2026-09-09 운영자).
    // 겹친 두 원은 벤 다이어그램으로 읽혀 "무엇이 겹치나" 를 묻는 그림이었다.
    // 궁합이 파는 것은 겹침이 아니라 두 사람이 이어져 있다는 것이다.
    // 2026-09-10 에 종목이 셋으로 줄면서 이 그림이 최애 궁합으로 옮겨 왔다 —
    // 하는 말이 같아서 새로 그리지 않았다.
    case "idol":
      return (
        <svg {...common}>
          <circle cx="6" cy="8" r="2.6" />
          <circle cx="18" cy="16" r="2.6" />
          {/* 두 점을 잇는 실 — 팽팽하지 않게 늘어뜨린다 */}
          <path d="M8.4 9.4c1.6 2 2 4.4 1.2 6 1.6-1.2 4-1 5.7.4" />
        </svg>
      );
  }
}
