import "server-only";

// 귀인 지도 — DB. 서버에서만 만진다 (RLS 가 anon 을 전부 막는다).
//
// 생년월일은 seal()(리딩·토큰과 같은 AES-256-GCM) 로 잠가 저장하고, 꺼내는
// 곳은 관계 계산 한 자리뿐이다. 이 파일 밖으로 평문 생년월일이 나가는 반환은
// 하나도 없다 — 화면·이벤트·로그로 새는 길을 원천에서 끊는다.

import { open, seal } from "@/lib/crypto";
import { personaOf, relate } from "@/lib/guin-calc";
import type { GuinBirthInput, GuinNodeView, GuinRelationshipResult } from "@/lib/guin-map";
import { hashKey, keyMatches, newSecretKey, newShareToken } from "@/lib/guin-token";
import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";

/** 한 지도에 앉을 수 있는 최대 인원 — 폭주·스팸 상한 */
const MAX_PARTICIPANTS = 100;

interface SealedBirth extends GuinBirthInput {
  /** 봉인 용도 표식 — 다른 blob 을 열어 생년월일로 오독하지 않기 위해 */
  g: "guin";
}

function sealBirth(birth: GuinBirthInput): string {
  return seal({ g: "guin", year: birth.year, month: birth.month, day: birth.day, hour: birth.hour } satisfies SealedBirth);
}

function openBirth(sealed: string): GuinBirthInput | null {
  const parsed = open<SealedBirth>(sealed);
  if (!parsed || parsed.g !== "guin") return null;
  return { year: parsed.year, month: parsed.month, day: parsed.day, hour: parsed.hour };
}

export interface GuinMapRow {
  id: string;
  shareToken: string;
  ownerKeyHash: string;
  ownerUserId: number | null;
  ownerNickname: string;
  ownerBirthSealed: string;
  showScores: boolean;
  status: "active" | "disabled" | "deleted";
}

export async function createGuinMap(params: {
  nickname: string;
  birth: GuinBirthInput;
  userId: number | null;
}): Promise<{ token: string; ownerKey: string } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const token = newShareToken();
  const ownerKey = newSecretKey();
  const { error } = await db.from("lr_guin_maps").insert({
    share_token: token,
    owner_key_hash: hashKey(ownerKey),
    owner_user_id: params.userId,
    owner_nickname: params.nickname,
    owner_birth_sealed: sealBirth(params.birth),
  });
  if (error) throw databaseError("귀인 지도 생성", error);
  return { token, ownerKey };
}

export async function loadGuinMap(token: string): Promise<GuinMapRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_guin_maps")
    .select("id,share_token,owner_key_hash,owner_user_id,owner_nickname,owner_birth_sealed,show_scores,status")
    .eq("share_token", token)
    .maybeSingle();
  if (error) throw databaseError("귀인 지도 조회", error);
  if (!data || data.status === "deleted") return null;
  return {
    id: String(data.id),
    shareToken: String(data.share_token),
    ownerKeyHash: String(data.owner_key_hash),
    ownerUserId: data.owner_user_id === null ? null : Number(data.owner_user_id),
    ownerNickname: String(data.owner_nickname),
    ownerBirthSealed: String(data.owner_birth_sealed),
    showScores: Boolean(data.show_scores),
    status: data.status === "disabled" ? "disabled" : "active",
  };
}

/**
 * 지도 머리에 쓸 주인 캐릭터. 봉인을 열어 파생값(오행·띠)만 내보낸다 —
 * 생년월일 평문은 이 파일 밖으로 나가지 않는다는 규칙 그대로다.
 */
export function ownerPersonaOf(map: GuinMapRow): { elementLabel: string; animal: string; dayGan: string } | null {
  const birth = openBirth(map.ownerBirthSealed);
  return birth ? personaOf(birth) : null;
}

export function isOwnerKey(map: GuinMapRow, key: string | null | undefined): boolean {
  return keyMatches(key, map.ownerKeyHash);
}

/** participantKey 가 이 지도의 참여자 것이면 그 참여자 id, 아니면 null */
export async function participantIdOfKey(mapId: string, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_guin_participants")
    .select("id")
    .eq("map_id", mapId)
    .eq("participant_key_hash", hashKey(key))
    .maybeSingle();
  if (error) throw databaseError("참여 키 확인", error);
  return data?.id ? String(data.id) : null;
}

export async function listGuinNodes(mapId: string): Promise<GuinNodeView[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_guin_relationships")
    .select("participant_id,score,role,result_json,lr_guin_participants!inner(id,nickname)")
    .eq("map_id", mapId)
    .order("created_at", { ascending: true });
  if (error) throw databaseError("귀인 지도 노드 조회", error);
  return (data ?? []).map((row) => {
    const result = row.result_json as GuinRelationshipResult;
    const participant = row.lr_guin_participants as unknown as { id: string; nickname: string };
    return {
      id: String(participant.id),
      nickname: String(participant.nickname),
      role: result.role,
      roleLabel: result.roleLabel,
      roleTagline: result.roleTagline,
      elementLabel: result.elementLabel,
      score: Number(row.score),
      strengths: result.strengths,
      cautions: result.cautions,
      conversationPrompt: result.conversationPrompt,
      facts: result.facts,
    };
  });
}

/**
 * 친구 참여. 참여자 행 + 관계 행을 만들고 참여 키를 돌려준다.
 *
 * idempotencyKey 는 브라우저가 지도마다 하나 만들어 들고 온다. 더블클릭·
 * 새로고침 재제출이 같은 키로 오므로 unique(map_id, idempotency_key) 에
 * 막히고, 그때는 새 참여자를 만드는 대신 그 행의 참여 키를 갈아 끼워
 * 돌려준다 — 같은 브라우저라 마지막 키만 들고 있으면 된다.
 */
export async function joinGuinMap(params: {
  map: GuinMapRow;
  nickname: string;
  birth: GuinBirthInput;
  idempotencyKey: string;
  userId: number | null;
}): Promise<
  | { ok: true; participantKey: string; node: GuinNodeView; replayed: boolean }
  | { ok: false; reason: "full" | "owner_birth_unreadable" | "failed" }
> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, reason: "failed" };
  const { map } = params;

  const ownerBirth = openBirth(map.ownerBirthSealed);
  if (!ownerBirth) return { ok: false, reason: "owner_birth_unreadable" };

  const { count, error: countError } = await db
    .from("lr_guin_participants")
    .select("id", { count: "exact", head: true })
    .eq("map_id", map.id);
  if (countError) throw databaseError("참여 인원 확인", countError);
  if ((count ?? 0) >= MAX_PARTICIPANTS) return { ok: false, reason: "full" };

  const participantKey = newSecretKey();
  const { data: inserted, error } = await db
    .from("lr_guin_participants")
    .insert({
      map_id: map.id,
      participant_key_hash: hashKey(participantKey),
      participant_user_id: params.userId,
      nickname: params.nickname,
      birth_sealed: sealBirth(params.birth),
      idempotency_key: params.idempotencyKey,
      consented_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // 같은 브라우저의 재제출. 새 행 대신 있던 행의 키를 갈아 끼운다.
    if (error.code === "23505") {
      const { data: existing, error: findError } = await db
        .from("lr_guin_participants")
        .select("id")
        .eq("map_id", map.id)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
      if (findError || !existing) throw databaseError("참여 재확인", findError ?? error);
      const { error: rekeyError } = await db
        .from("lr_guin_participants")
        .update({ participant_key_hash: hashKey(participantKey) })
        .eq("id", existing.id);
      if (rekeyError) throw databaseError("참여 키 갱신", rekeyError);
      const nodes = await listGuinNodes(map.id);
      const node = nodes.find((item) => item.id === String(existing.id));
      if (!node) return { ok: false, reason: "failed" };
      return { ok: true, participantKey, node, replayed: true };
    }
    throw databaseError("귀인 지도 참여", error);
  }
  if (!inserted) return { ok: false, reason: "failed" };

  // 관계는 주인 기준이다 — 참여자가 주인에게 무엇인가.
  const result = relate(ownerBirth, params.birth);
  const { error: relError } = await db.from("lr_guin_relationships").insert({
    map_id: map.id,
    participant_id: inserted.id,
    score: result.score,
    role: result.role,
    result_json: result,
    calculation_version: result.calculationVersion,
  });
  if (relError) {
    // 관계 없는 참여자를 남기지 않는다 — 반쪽 노드는 지도에 구멍으로 보인다.
    await db.from("lr_guin_participants").delete().eq("id", inserted.id);
    throw databaseError("관계 저장", relError);
  }

  const node: GuinNodeView = {
    id: String(inserted.id),
    nickname: params.nickname,
    role: result.role,
    roleLabel: result.roleLabel,
    roleTagline: result.roleTagline,
    elementLabel: result.elementLabel,
    score: result.score,
    strengths: result.strengths,
    cautions: result.cautions,
    conversationPrompt: result.conversationPrompt,
    facts: result.facts,
  };
  return { ok: true, participantKey, node, replayed: false };
}

/**
 * 참여자 삭제 — 주인 키 또는 그 참여자 본인의 키만 지울 수 있다.
 * 행을 실제로 지운다(관계는 cascade). 두 번 불러도 같은 결과다.
 */
export async function removeGuinParticipant(params: {
  map: GuinMapRow;
  participantId: string;
  ownerKey?: string | null;
  participantKey?: string | null;
}): Promise<"deleted" | "forbidden"> {
  const db = getSupabaseAdmin();
  if (!db) return "forbidden";
  const owner = isOwnerKey(params.map, params.ownerKey);
  const selfId = owner ? null : await participantIdOfKey(params.map.id, params.participantKey);
  if (!owner && selfId !== params.participantId) return "forbidden";
  const { error } = await db
    .from("lr_guin_participants")
    .delete()
    .eq("map_id", params.map.id)
    .eq("id", params.participantId);
  if (error) throw databaseError("참여자 삭제", error);
  return "deleted";
}

export async function updateGuinMap(params: {
  map: GuinMapRow;
  showScores?: boolean;
  status?: "active" | "disabled";
}): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.showScores !== undefined) patch.show_scores = params.showScores;
  if (params.status !== undefined) patch.status = params.status;
  const { error } = await db.from("lr_guin_maps").update(patch).eq("id", params.map.id);
  if (error) throw databaseError("귀인 지도 설정", error);
}

/** 지도와 딸린 전부를 실제로 지운다 (참여자·관계는 cascade). 멱등. */
export async function deleteGuinMap(mapId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db.from("lr_guin_maps").delete().eq("id", mapId);
  if (error) throw databaseError("귀인 지도 삭제", error);
}

/** 게스트로 만든 지도를 나중에 로그인한 계정에 잇는다. */
export async function claimGuinMap(mapId: string, userId: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db
    .from("lr_guin_maps")
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", mapId)
    .is("owner_user_id", null);
  if (error) throw databaseError("귀인 지도 계정 연결", error);
}
