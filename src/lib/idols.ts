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
  {
    id: "txt",
    label: "투모로우바이투게더",
    aliases: ["TXT", "투바투"],
    members: [
      { name: "연준", birth: "1999-09-13" },
      { name: "수빈", birth: "2000-12-05" },
      { name: "범규", birth: "2001-03-13" },
      { name: "태현", birth: "2002-02-05" },
      { name: "휴닝카이", birth: "2002-08-14" },
    ],
  },
  {
    id: "monstax",
    label: "몬스타엑스",
    aliases: ["MONSTA X"],
    members: [
      { name: "셔누", birth: "1992-06-18" },
      { name: "민혁", birth: "1993-11-03" },
      { name: "기현", birth: "1993-11-05" },
      { name: "형원", birth: "1994-01-22" },
      { name: "주헌", birth: "1994-10-06" },
      { name: "아이엠", birth: "1996-09-26" },
    ],
  },
  {
    id: "seventeen",
    label: "세븐틴",
    aliases: ["SEVENTEEN"],
    members: [
      { name: "에스쿱스", birth: "1995-08-08" },
      { name: "정한", birth: "1995-10-04" },
      { name: "조슈아", birth: "1995-12-30" },
      { name: "준", birth: "1996-06-10" },
      { name: "호시", birth: "1996-06-15" },
      { name: "원우", birth: "1996-07-17" },
      { name: "우지", birth: "1996-11-22" },
      { name: "디에잇", birth: "1997-11-07" },
      { name: "민규", birth: "1997-04-06" },
      { name: "도겸", birth: "1997-02-18" },
      { name: "승관", birth: "1998-01-16" },
      { name: "버논", birth: "1998-02-18" },
      { name: "디노", birth: "1999-02-11" },
    ],
  },
  {
    id: "straykids",
    label: "스트레이키즈",
    aliases: ["Stray Kids", "스키즈"],
    members: [
      { name: "방찬", birth: "1997-10-03" },
      { name: "리노", birth: "1998-10-25" },
      { name: "창빈", birth: "1999-08-11" },
      { name: "현진", birth: "2000-03-20" },
      { name: "한", birth: "2000-09-14" },
      { name: "필릭스", birth: "2000-09-15" },
      { name: "승민", birth: "2000-09-22" },
      { name: "아이엔", birth: "2001-02-08" },
    ],
  },
  {
    id: "enhypen",
    label: "엔하이픈",
    aliases: ["ENHYPEN"],
    members: [
      { name: "정원", birth: "2003-02-09" },
      { name: "희승", birth: "2001-10-15" },
      { name: "제이", birth: "2002-04-20" },
      { name: "제이크", birth: "2002-11-15" },
      { name: "성훈", birth: "2002-12-08" },
      { name: "선우", birth: "2003-06-24" },
      { name: "니키", birth: "2005-12-09" },
    ],
  },
  {
    id: "nct127",
    label: "NCT 127",
    aliases: ["NCT"],
    members: [
      { name: "태일", birth: "1994-06-14" },
      { name: "쟈니", birth: "1995-02-09" },
      { name: "태용", birth: "1995-07-01" },
      { name: "유타", birth: "1995-10-26" },
      { name: "도영", birth: "1996-02-01" },
      { name: "재현", birth: "1997-02-14" },
      { name: "정우", birth: "1998-02-19" },
      { name: "마크", birth: "1999-08-02" },
      { name: "해찬", birth: "2000-06-06" },
    ],
  },
  {
    id: "twice",
    label: "트와이스",
    aliases: ["TWICE"],
    members: [
      { name: "나연", birth: "1995-09-22" },
      { name: "정연", birth: "1996-11-01" },
      { name: "모모", birth: "1996-11-09" },
      { name: "사나", birth: "1996-12-29" },
      { name: "지효", birth: "1997-02-01" },
      { name: "미나", birth: "1997-03-24" },
      { name: "다현", birth: "1998-05-28" },
      { name: "채영", birth: "1999-04-23" },
      { name: "쯔위", birth: "1999-06-14" },
    ],
  },
  {
    id: "redvelvet",
    label: "레드벨벳",
    aliases: ["Red Velvet"],
    members: [
      { name: "아이린", birth: "1991-03-29" },
      { name: "슬기", birth: "1994-02-10" },
      { name: "웬디", birth: "1994-02-21" },
      { name: "조이", birth: "1996-09-03" },
      { name: "예리", birth: "1999-03-05" },
    ],
  },
  {
    id: "gidle",
    label: "아이들",
    aliases: ["(G)I-DLE", "여자아이들"],
    members: [
      { name: "미연", birth: "1997-01-31" },
      { name: "민니", birth: "1997-10-23" },
      { name: "소연", birth: "1998-08-26" },
      { name: "우기", birth: "1999-09-23" },
      { name: "슈화", birth: "2000-01-06" },
    ],
  },
  {
    id: "nmixx",
    label: "엔믹스",
    aliases: ["NMIXX"],
    members: [
      { name: "해원", birth: "2002-01-11" },
      { name: "설윤", birth: "2004-04-26" },
      { name: "배이", birth: "2004-06-08" },
      { name: "지우", birth: "2005-04-13" },
      { name: "규진", birth: "2006-01-15" },
    ],
  },
  {
    id: "itzy",
    label: "있지",
    aliases: ["ITZY"],
    members: [
      { name: "예지", birth: "2000-05-26" },
      { name: "리아", birth: "2000-07-21" },
      { name: "류진", birth: "2001-04-17" },
      { name: "채령", birth: "2001-06-05" },
      { name: "유나", birth: "2003-12-09" },
    ],
  },
  {
    id: "exo",
    label: "엑소",
    aliases: ["EXO"],
    members: [
      { name: "시우민", birth: "1990-03-26" },
      { name: "수호", birth: "1991-05-22" },
      { name: "레이", birth: "1991-10-07" },
      { name: "백현", birth: "1992-05-06" },
      { name: "찬열", birth: "1992-11-27" },
      { name: "디오", birth: "1993-01-12" },
      { name: "카이", birth: "1994-01-14" },
      { name: "세훈", birth: "1994-04-12" },
    ],
  },
  {
    id: "bigbang",
    label: "빅뱅",
    aliases: ["BIGBANG"],
    members: [
      { name: "지드래곤", birth: "1988-08-18" },
      { name: "태양", birth: "1988-05-18" },
      { name: "대성", birth: "1989-04-26" },
    ],
  },
  {
    id: "day6",
    label: "데이식스",
    aliases: ["DAY6"],
    members: [
      { name: "성진", birth: "1993-01-08" },
      { name: "영케이", birth: "1993-12-19" },
      { name: "원필", birth: "1994-08-19" },
      { name: "도운", birth: "1995-08-06" },
    ],
  },
  {
    id: "rescene",
    label: "리센느",
    aliases: ["RESCENE"],
    members: [
      { name: "원이", birth: "2004-05-25" },
      { name: "리브", birth: "2006-10-11" },
      { name: "미나미", birth: "2006-11-29" },
      { name: "메이", birth: "2008-08-19" },
      { name: "제나", birth: "2008-11-27" },
    ],
  },
  // ── 2024~2025 데뷔 (2026-09-09) ──
  // 아래 전부 위키백과와 나무위키 두 곳의 멤버 표가 날짜까지 일치한 것만 적었다.
  // 한 곳만 나온 그룹은 넣지 않았다.
  {
    id: "nctwish",
    label: "NCT WISH",
    aliases: ["엔시티 위시"],
    members: [
      { name: "시온", birth: "2002-05-11" },
      { name: "리쿠", birth: "2003-06-28" },
      { name: "유우시", birth: "2004-04-05" },
      { name: "재희", birth: "2005-06-21" },
      { name: "료", birth: "2007-08-04" },
      { name: "사쿠야", birth: "2007-11-18" },
    ],
  },
  {
    id: "katseye",
    label: "캣츠아이",
    aliases: ["KATSEYE"],
    members: [
      { name: "마농", birth: "2002-06-26" },
      { name: "소피아", birth: "2002-12-31" },
      { name: "다니엘라", birth: "2004-07-01" },
      { name: "라라", birth: "2005-11-03" },
      { name: "메간", birth: "2006-02-10" },
      { name: "윤채", birth: "2007-12-06" },
    ],
  },
  {
    id: "izna",
    label: "이즈나",
    aliases: ["izna"],
    members: [
      { name: "마이", birth: "2004-10-28" },
      { name: "방지민", birth: "2005-05-08" },
      { name: "코코", birth: "2006-11-14" },
      { name: "유사랑", birth: "2007-04-18" },
      { name: "최정은", birth: "2007-08-04" },
      { name: "정세비", birth: "2008-01-22" },
    ],
  },
  {
    id: "meovv",
    label: "미야오",
    aliases: ["MEOVV"],
    members: [
      { name: "수인", birth: "2005-04-12" },
      { name: "가원", birth: "2005-04-27" },
      { name: "안나", birth: "2005-11-17" },
      { name: "나린", birth: "2007-08-15" },
      { name: "엘라", birth: "2008-12-01" },
    ],
  },
  {
    id: "hearts2hearts",
    label: "하츠투하츠",
    aliases: ["Hearts2Hearts"],
    members: [
      { name: "카르멘", birth: "2006-03-28" },
      { name: "지우", birth: "2006-09-07" },
      { name: "유하", birth: "2007-04-12" },
      { name: "스텔라", birth: "2007-06-18" },
      { name: "주은", birth: "2008-12-03" },
      { name: "에이나", birth: "2008-12-20" },
      { name: "이안", birth: "2009-10-09" },
      { name: "예온", birth: "2010-04-19" },
    ],
  },
  {
    id: "kiiikiii",
    label: "키키",
    aliases: ["KiiiKiii"],
    members: [
      { name: "이솔", birth: "2005-09-18" },
      { name: "수이", birth: "2006-04-10" },
      { name: "지유", birth: "2006-05-14" },
      { name: "하음", birth: "2006-11-14" },
      { name: "키야", birth: "2010-12-18" },
    ],
  },
  {
    id: "alldayproject",
    label: "올데이 프로젝트",
    aliases: ["ALLDAY PROJECT"],
    members: [
      { name: "애니", birth: "2002-01-23" },
      { name: "타잔", birth: "2002-09-27" },
      { name: "베일리", birth: "2004-02-24" },
      { name: "우찬", birth: "2005-01-20" },
      { name: "영서", birth: "2005-11-13" },
    ],
  },
  {
    id: "cortis",
    label: "코르티스",
    aliases: ["CORTIS"],
    members: [
      { name: "제임스", birth: "2005-10-14" },
      { name: "주훈", birth: "2008-01-03" },
      { name: "마틴", birth: "2008-03-20" },
      { name: "성현", birth: "2009-01-13" },
      { name: "건호", birth: "2009-02-14" },
    ],
  },
];

export const IDOL_GROUP_MAP = new Map(IDOL_GROUPS.map((g) => [g.id, g]));

/**
 * 홈 칩에 세울 순서. 앞의 여덟만 먼저 보이고 나머지는 "더보기" 뒤에 있다.
 *
 * 명단에 있는 그룹은 전부 여기 적는다 — 빠지면 홈에서 못 찾고, 그러면 명단에
 * 넣은 뜻이 없다. 테스트가 빠진 것을 잡는다.
 */
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
  "txt",
  "seventeen",
  "straykids",
  "enhypen",
  "monstax",
  "nct127",
  "twice",
  "redvelvet",
  "gidle",
  "nmixx",
  "itzy",
  "exo",
  "bigbang",
  "day6",
  "rescene",
  "nctwish",
  "katseye",
  "izna",
  "meovv",
  "hearts2hearts",
  "kiiikiii",
  "alldayproject",
  "cortis",
] as const;
