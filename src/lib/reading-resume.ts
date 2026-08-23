// 아직 만들지 않은 유료 본문을 나중에 이어 만들기 위한 재개 정보.
//
// 발급(/api/reading) 때는 미리보기에 필요한 절까지만 만들고, 나머지는 결제가 확인된
// 뒤(/api/unlock)에 만든다. 그 사이에 "무엇을 이어서 만들어야 하는가"가 서버에 남아
// 있어야 한다. 클라이언트 blob에만 두면 계좌이체처럼 며칠 뒤에 승인되는 경우
// 기기를 바꾸거나 저장소를 비운 사용자에게 돈만 받고 못 주는 일이 생긴다.
//
// lr_readings에 컬럼을 더하지 않고 별도 테이블을 쓴다(store.ts를 건드리지 않는다).
// 완성되면 지우므로, 남아 있는 행은 곧 "결제까지 가지 않은 리딩"이다.

import fs from "node:fs/promises";
import path from "node:path";
import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Provider } from "@/lib/ai";
import type { ReadingContinuityState } from "@/lib/reading-compose";
import type { StructuredReport } from "@/lib/reading-prompt";
import type { SajuFacts } from "@/lib/saju-facts";

export interface ResumeInput {
  category: string;
  facts: SajuFacts;
  partnerFacts: SajuFacts | null;
  /**
   * 발급 시점에 켜졌던 규칙 id.
   * 규칙 표현을 나중에 고쳐도 이미 판 리딩은 발급 때의 해석으로 이어 쓰게 못박는다.
   */
  ruleIds: string[];
  currentScene: string;
  /** 발급 때 적힌 직업. 나머지 절도 같은 무대에서 써야 앞뒤가 맞는다. */
  occupation?: string;
  /** 발급 시각 — 대운·세운을 그때 기준으로 다시 잡기 위해 */
  issuedAt: string;
  /** 발급 때 이미 만들어 둔 절 수. 이 다음 항목부터 이어 만든다. */
  doneSections: number;
  /** 발급 때 범위 검사를 통과한 정확한 목차. 상품 기본 목차와 달라질 수 있다. */
  outline?: string[];
  /** 무료에서 확정한 머리와 첫 절. 기기·브라우저가 바뀌어도 서버에서 복원한다. */
  partialReport?: StructuredReport | null;
  /** 후속 절이 무료 공개분의 결론·문체를 이어받게 하는 짧은 상태. */
  continuity?: ReadingContinuityState;
  /** 무료 초안을 만든 제공사와 모델. 결제 후에도 같은 모델을 지목한다. */
  provider?: Provider;
  model?: string;
  /** 무료와 유료가 같은 프롬프트 계약인지 감사하기 위한 버전. */
  promptVersion?: string;
}

const DIR = path.join(process.cwd(), "data", "resume");

function fileOf(id: string): string | null {
  // UUID 형식만 허용 — 경로 조작 방지 (store.ts와 같은 규칙)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  return path.join(DIR, `${id}.json`);
}

export async function saveResume(readingId: string, input: ResumeInput): Promise<void> {
  const db = getSupabaseAdmin();
  if (db) {
    const { error } = await db
      .from("lr_reading_resume")
      .upsert({ reading_id: readingId, payload: input }, { onConflict: "reading_id" });
    if (error) throw databaseError("재개 정보 저장", error);
    return;
  }

  const f = fileOf(readingId);
  if (!f) throw new Error("invalid reading id");
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(f, JSON.stringify(input), "utf8");
}

/** 없으면 null — 재개 정보가 없는 옛 리딩은 저장된 전문을 그대로 쓴다 */
export async function loadResume(readingId: string): Promise<ResumeInput | null> {
  const db = getSupabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("lr_reading_resume")
      .select("payload")
      .eq("reading_id", readingId)
      .maybeSingle();
    if (error) throw databaseError("재개 정보 조회", error);
    return (data?.payload as ResumeInput | undefined) ?? null;
  }

  const f = fileOf(readingId);
  if (!f) return null;
  try {
    return JSON.parse(await fs.readFile(f, "utf8")) as ResumeInput;
  } catch {
    return null;
  }
}

/**
 * 본문이 완성돼 DB에 전문이 들어간 뒤에 지운다.
 * 지우기에 실패해도 리딩은 이미 완성돼 있으므로 던지지 않는다 — 다음 완성 시도가
 * "이미 절이 다 있다"로 곧장 끝나기 때문에 남은 행은 해가 되지 않는다.
 */
export async function clearResume(readingId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (db) {
    const { error } = await db.from("lr_reading_resume").delete().eq("reading_id", readingId);
    if (error) console.error("재개 정보 삭제 실패:", error);
    return;
  }

  const f = fileOf(readingId);
  if (!f) return;
  await fs.rm(f, { force: true }).catch(() => {});
}
