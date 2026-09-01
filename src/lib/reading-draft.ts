"use client";

// 사주 입력 초안 — 폼(/reading), 로그인 복귀, 생성 대기 화면(/reading/generating)이 함께 쓴다.
// sessionStorage에 두어 탭을 닫으면 사라지고, 2시간이 지난 초안은 무효로 본다.

import { PRODUCTS } from "@/lib/products";

export interface PersonForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: string;
  /** 입력한 날짜가 양력인지 음력인지. 비어 있으면 양력으로 본다. */
  calendar?: "solar" | "lunar";
  /** 음력일 때만 쓴다 */
  leapMonth?: boolean;
}

export interface ReadingDraft {
  category: string;
  offerId?: string;
  /** 세트로 시작한 리딩 (bundles.ts). 값이 세트 값으로 잡힌다. */
  bundleId?: string;
  me: PersonForm;
  partner: PersonForm;
  withPartner: boolean;
  /** 지금 가장 답답한 것 한 줄 — 리포트가 이 장면에 답하도록 프롬프트로 넘어간다 */
  question: string;
  /**
   * 하는 일. 비워도 된다.
   *
   * 명식은 생년월일시로 정해지므로 이 값은 **계산에 들어가지 않는다.**
   * 같은 흐름도 3교대 간호사와 프리랜서에게 다른 장면으로 나타나서,
   * 이걸 알면 "답장이 늦어요" 대신 그 사람의 하루에서 장면을 고를 수 있다.
   */
  occupation?: string;
  /**
   * 폼이 이 초안을 보자마자 생성을 다시 시작해도 되는가.
   *
   * 로그인하러 나갔다 돌아온 초안은 true(기본) — 사용자가 이미 제출한 것이라
   * 이어서 돌리는 게 맞다. 생성 화면이 "뒤로가기 대비"로 되돌려 둔 초안은
   * false — 여기서도 자동으로 다시 돌리면 폼과 생성 화면이 서로를 계속
   * 부르는 되돌이표가 된다. 값 복원까지만 하고 제출은 사람 손에 맡긴다.
   */
  autoResume?: boolean;
  createdAt: number;
}

export const emptyPerson: PersonForm = {
  year: "",
  month: "",
  day: "",
  hour: "",
  gender: "",
  calendar: "solar",
  leapMonth: false,
};

const KEY = "loverabbit_reading_draft_v1";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function parsePerson(p: PersonForm) {
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour: !p.hour || p.hour === "unknown" ? null : parseInt(p.hour, 10),
    gender: p.gender === "M" ? "M" : "F",
    // 음력이면 서버가 양력으로 바꾼다. 클라이언트가 바꿔 보내면 검증을 우회할 수 있다.
    calendar: p.calendar === "lunar" ? ("lunar" as const) : ("solar" as const),
    leapMonth: p.leapMonth === true,
  };
}

/**
 * 초안을 탭에 남긴다. 실패하면 false — 던지지 않는다.
 *
 * 저장이 막힌 브라우저에서도 로그인 창 자체는 열려야 한다. 다만 조용히
 * 삼키면 로그인하고 돌아온 사람이 **다 채운 폼이 빈 것을** 보게 된다 —
 * 부르는 쪽이 미리 알릴 수 있게 결과를 돌려준다.
 */
export function saveReadingDraft(draft: ReadingDraft): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearReadingDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 이미 제거됐거나 스토리지를 사용할 수 없으면 무시한다.
  }
}

function readDraft(): ReadingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ReadingDraft;
    if (
      !PRODUCTS.some((item) => item.id === draft?.category) ||
      !draft.me ||
      !draft.partner ||
      !Number.isFinite(draft.createdAt) ||
      Date.now() - draft.createdAt > MAX_AGE_MS
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** 초안을 남겨둔 채로 읽는다 (폼 복원·이동 판단용). */
export function peekReadingDraft(): ReadingDraft | null {
  const draft = readDraft();
  if (!draft) clearReadingDraft();
  return draft;
}

/** 초안을 읽고 즉시 비운다. 생성 화면이 한 번만 소비하도록 해 재시도 루프를 막는다. */
export function takeReadingDraft(): ReadingDraft | null {
  const draft = readDraft();
  clearReadingDraft();
  return draft;
}
