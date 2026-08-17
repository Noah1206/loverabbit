// 리딩 파일 저장소 — 결제 전에는 풀 리딩이 클라이언트로 절대 나가지 않게 하는 핵심.
// ⚠️ Vercel 등 서버리스 배포 시 파일시스템은 휘발성 — 런칭 시 Upstash Redis/Vercel KV로 교체할 것.
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "readings");

export const READING_PRICE = 7900;
export const MEMBERSHIP_PRICE = 27900; // 밤의 멤버십 (30일 무제한)

export function priceFor(_category: string): number {
  return READING_PRICE;
}

export interface StoredReading {
  id: string;
  createdAt: string;
  category: string;
  teaser: string;
  full: string;
  chart: { me: string; partner: string | null };
  provider: string;
  price: number;
  unlocked: boolean;
  // 결제 기록 — 계좌이체는 입금코드로 통장 내역과 사후 대조한다
  payment?: { method: "toss-pg" | "transfer" | "membership" | "mock"; depositorCode?: string; at: string };
}

function fileOf(id: string): string | null {
  // UUID 형식만 허용 — 경로 조작 방지
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  return path.join(DIR, `${id}.json`);
}

export async function saveReading(r: StoredReading): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const f = fileOf(r.id);
  if (!f) throw new Error("invalid reading id");
  await fs.writeFile(f, JSON.stringify(r), "utf8");
}

export async function getReading(id: string): Promise<StoredReading | null> {
  const f = fileOf(id);
  if (!f) return null;
  try {
    return JSON.parse(await fs.readFile(f, "utf8")) as StoredReading;
  } catch {
    return null;
  }
}

export async function markUnlocked(
  id: string,
  payment: StoredReading["payment"]
): Promise<StoredReading | null> {
  const r = await getReading(id);
  if (!r) return null;
  r.unlocked = true;
  r.payment = payment;
  await saveReading(r);
  return r;
}
