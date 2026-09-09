/**
 * 연예인 궁합에 쓰는 최애 명단 (2026-09-09 운영자).
 *
 * ── 무엇을 담고 무엇을 안 담는가 ──
 *
 * 여기 있는 것은 **공개 프로필 수준의 세 가지**뿐이다: 그룹, 활동명, 생년월일.
 * 그 셋은 소속사가 스스로 내는 값이라 이 저장소가 캐낸 것이 아니다.
 *
 * 그 밖의 것은 담지 않는다 — 본명, 사진, 연애·건강·가족에 관한 어떤 것도.
 * 계산에 필요하지 않고, 필요하지 않은 개인정보를 들고 있는 것 자체가 위험이다.
 *
 * 태어난 시는 공개값이 아니라서 없다. 시주 없이 연·월·일 세 기둥으로만 본다 —
 * 리포트가 그 한계를 스스로 밝힌다(IDOL-META-NO-HOUR-PARTNER).
 *
 * ── 이 명단이 하는 일 ──
 *
 * 사용자가 최애의 생일을 몰라도 이름만 눌러 볼 수 있게 하는 것. 그것뿐이다.
 * 명단에 없으면 상대 생년월일을 직접 적는 길이 그대로 열려 있다(/product/idol).
 *
 * ── 고칠 때 ──
 *
 * 새 그룹을 더하려면 여기에 줄을 더한다. 날짜가 틀리면 명식이 통째로 틀리므로,
 * 더할 때는 공개 프로필에서 확인한 값만 적는다. 확실하지 않으면 안 적는다 —
 * 틀린 명식으로 나간 리포트는 되돌릴 수 없다.
 */

export interface IdolMember {
  /** 활동명 */
  name: string;
  /** 생년월일 (YYYY-MM-DD, 양력) */
  birth: string;
}

export interface IdolGroup {
  /** URL 과 저장에 쓰는 id */
  id: string;
  /** 화면에 적는 이름 */
  label: string;
  /** 같은 그룹을 다른 이름으로 찾는 사람들 — 검색에만 쓴다 */
  aliases?: string[];
  members: IdolMember[];
}

export const IDOL_GROUPS: IdolGroup[] = [
  {
    id: "bts",
    label: "BTS",
    aliases: ["방탄소년단"],
    members: [
      { name: "진", birth: "1992-12-04" },
      { name: "슈가", birth: "1993-03-09" },
      { name: "제이홉", birth: "1994-02-18" },
      { name: "RM", birth: "1994-09-12" },
      { name: "지민", birth: "1995-10-13" },
      { name: "뷔", birth: "1995-12-30" },
      { name: "정국", birth: "1997-09-01" },
    ],
  },
  {
    id: "blackpink",
    label: "블랙핑크",
    aliases: ["BLACKPINK"],
    members: [
      { name: "지수", birth: "1995-01-03" },
      { name: "제니", birth: "1996-01-16" },
      { name: "로제", birth: "1997-02-11" },
      { name: "리사", birth: "1997-03-27" },
    ],
  },
  {
    id: "newjeans",
    label: "뉴진스",
    aliases: ["NewJeans"],
    members: [
      { name: "민지", birth: "2004-05-07" },
      { name: "하니", birth: "2004-10-06" },
      { name: "다니엘", birth: "2005-04-11" },
      { name: "해린", birth: "2006-05-15" },
      { name: "혜인", birth: "2008-04-21" },
    ],
  },
  {
    id: "ive",
    label: "IVE",
    aliases: ["아이브"],
    members: [
      { name: "안유진", birth: "2003-09-01" },
      { name: "가을", birth: "2002-09-24" },
      { name: "레이", birth: "2004-02-03" },
      { name: "장원영", birth: "2004-08-31" },
      { name: "리즈", birth: "2004-11-21" },
      { name: "이서", birth: "2007-02-21" },
    ],
  },
  {
    id: "aespa",
    label: "에스파",
    aliases: ["aespa"],
    members: [
      { name: "카리나", birth: "2000-04-11" },
      { name: "지젤", birth: "2000-10-30" },
      { name: "윈터", birth: "2001-01-01" },
      { name: "닝닝", birth: "2002-10-23" },
    ],
  },
  {
    id: "lesserafim",
    label: "르세라핌",
    aliases: ["LE SSERAFIM"],
    members: [
      { name: "김채원", birth: "2000-08-01" },
      { name: "사쿠라", birth: "1998-03-19" },
      { name: "허윤진", birth: "2001-10-08" },
      { name: "카즈하", birth: "2003-08-09" },
      { name: "홍은채", birth: "2006-11-10" },
    ],
  },
  {
    id: "iu",
    label: "아이유",
    aliases: ["IU"],
    members: [{ name: "아이유", birth: "1993-05-16" }],
  },
  {
    id: "riize",
    label: "라이즈",
    aliases: ["RIIZE"],
    members: [
      { name: "쇼타로", birth: "2000-11-25" },
      { name: "은석", birth: "2002-02-14" },
      { name: "성찬", birth: "2003-01-22" },
      { name: "원빈", birth: "2004-04-07" },
      { name: "소희", birth: "2004-08-09" },
      { name: "앤톤", birth: "2004-12-16" },
    ],
  },
  {
    id: "tws",
    label: "TWS",
    aliases: ["투어스"],
    members: [
      { name: "신유", birth: "2003-05-19" },
      { name: "도훈", birth: "2004-01-10" },
      { name: "영재", birth: "2004-09-08" },
      { name: "한진", birth: "2005-04-16" },
      { name: "지훈", birth: "2006-07-25" },
      { name: "경민", birth: "2007-04-08" },
    ],
  },
  {
    id: "illit",
    label: "아일릿",
    aliases: ["ILLIT"],
    members: [
      { name: "윤아", birth: "2004-09-15" },
      { name: "민주", birth: "2004-11-16" },
      { name: "모카", birth: "2004-11-13" },
      { name: "원희", birth: "2007-01-24" },
      { name: "이로하", birth: "2008-05-25" },
    ],
  },
];

export const IDOL_GROUP_MAP = new Map(IDOL_GROUPS.map((g) => [g.id, g]));

/** 홈 칩에 세울 순서. 나머지는 "더보기" 뒤에 있다 */
export const IDOL_CHIP_ORDER = [
  "tws",
  "illit",
  "lesserafim",
  "aespa",
  "iu",
  "riize",
  "ive",
  "blackpink",
  "bts",
  "newjeans",
] as const;
