// 그림의 저장고와 상태판.
//
// 그림은 한 장에 1MB가 넘는다. 리딩 한 건에 다섯 장이면 6MB라, DB 행에 넣을 수 없고
// 클라이언트 blob에 실을 수도 없다(봉인 blob은 URL 길이에 얹혀 다닌다).
// 그래서 파일은 Storage 에, "어느 장의 그림이 어디까지 됐나"만 테이블에 둔다.
//
// reading-resume.ts 와 같은 구조다 — Supabase 가 있으면 Supabase, 없으면 로컬 파일.
// 개발 기계에서 Storage 없이도 화면을 끝까지 볼 수 있어야 한다.

import fs from "node:fs/promises";
import path from "node:path";
import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ReadingImage, ReadingImageStatus } from "@/lib/reading-images";

const BUCKET = "reading-images";
const DIR = path.join(process.cwd(), "data", "reading-images");

/**
 * UUID 형식만 허용 — 경로 조작 방지 (store.ts·reading-resume.ts와 같은 규칙).
 *
 * 개발에서는 미리보기 하네스가 쓰는 "preview-jaehoe" 같은 id 도 받는다.
 * 운영에서는 받지 않는다 — 예측 가능한 id 로 남의 그림을 짚을 수 있으면 안 된다.
 */
function safeId(id: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return true;
  return process.env.NODE_ENV !== "production" && /^preview-[a-z0-9]{1,20}$/.test(id);
}

function objectKey(readingId: string, chapter: number): string {
  return `${readingId}/${chapter}.png`;
}

/**
 * 그림 한 장을 올리고 읽을 수 있는 주소를 돌려준다.
 * 실패하면 null — 부르는 쪽이 failed 로 적고 넘어간다.
 */
export async function putImage(
  readingId: string,
  chapter: number,
  bytes: Buffer
): Promise<string | null> {
  if (!safeId(readingId)) return null;
  const db = getSupabaseAdmin();

  if (db) {
    const key = objectKey(readingId, chapter);
    const { error } = await db.storage
      .from(BUCKET)
      .upload(key, bytes, { contentType: "image/png", upsert: true });
    if (error) {
      console.warn("그림 업로드 실패:", error.message);
      return null;
    }
    return db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  }

  // 개발용 — public 아래 두면 Next 가 그대로 내보낸다
  const dir = path.join(process.cwd(), "public", "generated", readingId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${chapter}.png`), bytes);
  return `/generated/${readingId}/${chapter}.png`;
}

/**
 * 상태판을 통째로 저장한다.
 *
 * 장마다 따로 쓰지 않고 한 덩어리로 쓰는 이유: 그림은 순서대로 만들어지고,
 * 화면은 "전부 어디까지 됐나" 를 한 번에 묻는다. 행을 나누면 폴링마다 조인이 붙는다.
 */
export async function saveImageState(readingId: string, images: ReadingImage[]): Promise<void> {
  if (!safeId(readingId)) return;
  const db = getSupabaseAdmin();

  if (db) {
    const { error } = await db
      .from("lr_reading_images")
      .upsert({ reading_id: readingId, images }, { onConflict: "reading_id" });
    if (error) throw databaseError("그림 상태 저장", error);
    return;
  }

  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${readingId}.json`), JSON.stringify(images), "utf8");
}

/**
 * 테이블이 아직 없을 때 나는 오류.
 *
 * 마이그레이션을 적용하기 전에도 화면이 돌아가야 한다 — 그림은 리딩의 덤이라,
 * 테이블 하나 없다고 리딩 화면이 죽으면 손해가 이득보다 크다.
 * 다른 오류는 그대로 던진다. 조용히 삼키면 무엇이 고장 났는지 알 수 없다.
 */
function tableMissing(error: { code?: string; message: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist/i.test(error.message);
}

async function readLocal(readingId: string): Promise<ReadingImage[] | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${readingId}.json`), "utf8")) as ReadingImage[];
  } catch {
    return null;
  }
}

/** 없으면 null — 그림을 만들기 전이거나 만들지 않는 리딩이다 */
export async function loadImageState(readingId: string): Promise<ReadingImage[] | null> {
  if (!safeId(readingId)) return null;
  const db = getSupabaseAdmin();

  if (db) {
    const { data, error } = await db
      .from("lr_reading_images")
      .select("images")
      .eq("reading_id", readingId)
      .maybeSingle();
    if (error) {
      if (!tableMissing(error)) throw databaseError("그림 상태 조회", error);
      console.warn("lr_reading_images 테이블이 아직 없어요. 로컬 파일로 대신합니다 (npm run db:push).");
      return readLocal(readingId);
    }
    return (data?.images as ReadingImage[] | undefined) ?? null;
  }

  return readLocal(readingId);
}

/** 한 장이 끝날 때마다 그 자리만 갱신한다 — 5분짜리 작업이라 중간 결과가 보여야 한다 */
export async function markImage(
  readingId: string,
  chapter: number,
  patch: { status: ReadingImageStatus; url?: string; alt?: string }
): Promise<void> {
  const current = (await loadImageState(readingId)) ?? [];
  const next = current.map((image) => (image.chapter === chapter ? { ...image, ...patch } : image));
  if (!next.some((image) => image.chapter === chapter)) next.push({ chapter, ...patch });
  await saveImageState(readingId, next.sort((a, b) => a.chapter - b.chapter));
}
