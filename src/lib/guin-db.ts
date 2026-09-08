import "server-only";

// 귀인 지도 — DB. 서버에서만 만진다 (RLS 가 anon 을 전부 막는다).
//
// 생년월일은 seal()(리딩·토큰과 같은 AES-256-GCM) 로 잠가 저장하고, 꺼내는
// 곳은 관계 계산 한 자리뿐이다. 이 파일 밖으로 평문 생년월일이 나가는 반환은
// 하나도 없다 — 화면·이벤트·로그로 새는 길을 원천에서 끊는다.

import { open, seal } from "@/lib/crypto";
import { personaOf, relate } from "@/lib/guin-calc";
import { GUIN_TEMPLATE_VERSION, buildGuinReport } from "@/lib/guin-templates";
import type {
  GuinAiReport,
  GuinBirthInput,
  GuinNodeView,
  GuinRelStatus,
  GuinRelationshipResult,
} from "@/lib/guin-map";
import { hashKey, keyMatches, newSecretKey, newShareToken, participantFingerprint } from "@/lib/guin-token";
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
    .select(
      "participant_id,score,role,result_json,reverse_json,context_status,ai_report_json,lr_guin_participants!inner(id,nickname)"
    )
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
      secondaryRoleLabel: result.secondaryRoleLabel ?? null,
      elementLabel: result.elementLabel,
      score: Number(row.score),
      scoreBand: result.scoreBand,
      axes: result.axes ?? null,
      strengths: result.strengths,
      cautions: result.cautions,
      conversationPrompt: result.conversationPrompt,
      facts: result.facts,
      reverse: (row.reverse_json as GuinRelationshipResult | null) ?? null,
      contextStatus: (row.context_status as GuinRelStatus | null) ?? null,
      aiReport: (row.ai_report_json as GuinAiReport | null) ?? null,
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
  /** 주인이 대신 넣었는가 (2026-09-08). 본인 동의 없이 들어온 행을 구분한다. */
  addedByOwner?: boolean;
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
  const birthdate = `${params.birth.year}-${params.birth.month}-${params.birth.day}`;
  const fingerprint = participantFingerprint(map.id, birthdate, params.nickname);
  const { data: inserted, error } = await db
    .from("lr_guin_participants")
    .insert({
      map_id: map.id,
      participant_key_hash: hashKey(participantKey),
      participant_user_id: params.userId,
      nickname: params.nickname,
      birth_sealed: sealBirth(params.birth),
      idempotency_key: params.idempotencyKey,
      added_by_owner: params.addedByOwner === true,
      participant_fingerprint: fingerprint,
      consented_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    /*
      두 그물 중 하나에 걸렸다 — 같은 브라우저의 재제출(멱등 키)이거나,
      같은 사람이 다른 기기·탭에서 다시 넣은 것(지문). 어느 쪽이든 새 행을
      만들지 않고 있던 행의 키를 갈아 끼워 돌려준다: 지금 요청한 기기가
      관리 권한(자기 기록 삭제)을 갖는 게 맞다.
    */
    if (error.code === "23505") {
      const { data: existing, error: findError } = await db
        .from("lr_guin_participants")
        .select("id")
        .eq("map_id", map.id)
        .or(`idempotency_key.eq.${params.idempotencyKey},participant_fingerprint.eq.${fingerprint}`)
        .limit(1)
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

  // 관계는 양방향이다 (guin-v3). 정방향(참여자가 주인에게 무엇인가)이 지도의
  // 기준이고, 역방향은 relate 를 뒤집어 **따로** 계산한다 — 텍스트만 뒤집으면
  // 생·극의 방향이 거짓말이 된다.
  const result = relate(ownerBirth, params.birth);
  const reverse = relate(params.birth, ownerBirth);
  const { error: relError } = await db.from("lr_guin_relationships").insert({
    map_id: map.id,
    participant_id: inserted.id,
    score: result.score,
    role: result.role,
    secondary_role: result.secondaryRole ?? null,
    axes_json: result.axes ?? null,
    result_json: result,
    reverse_json: reverse,
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
    secondaryRoleLabel: result.secondaryRoleLabel ?? null,
    elementLabel: result.elementLabel,
    score: result.score,
    scoreBand: result.scoreBand,
    axes: result.axes ?? null,
    strengths: result.strengths,
    cautions: result.cautions,
    conversationPrompt: result.conversationPrompt,
    facts: result.facts,
    reverse,
    contextStatus: null,
    aiReport: null,
  };
  return { ok: true, participantKey, node, replayed: false };
}

interface SealedNote {
  g: "guin-note";
  text: string;
}

/**
 * 참여자가 고른 실제 관계 상태를 저장하고, 그 문맥으로 리포트를 만든다.
 *
 * **모델을 부르지 않는다 (2026-09-08).** 전에는 여기서 사람당 한 번씩 모델을
 * 불렀다. 사람당 한 번이니 작아 보이지만, 이 기능의 목적은 사람을 다섯 명 열 명
 * 넣게 만드는 것이다 — 바이럴이 성공할수록 값이 오르는 구조였다. 지금은
 * 문구 표에서 조립한다(guin-templates.ts). 사람을 1,000명 넣어도 호출은 0이다.
 *
 * 유료 상세("왜 이 사람이 내 귀인인가")는 그대로 기존 리딩이 맡는다.
 * 무료는 WHAT, 유료는 WHY 다.
 *
 * 상태는 축 점수를 건드리지 않는다 — result_json/score 는 여기서 안 바뀐다.
 * 같은 입력이면 언제나 같은 문장이 나온다(해시로 고른다). 오늘 본 해석과
 * 내일 본 해석이 다르면 그건 해석이 아니라 뽑기다.
 */
export async function setGuinRelationshipContext(params: {
  map: GuinMapRow;
  participantId: string;
  status: GuinRelStatus;
  note?: string | null;
}): Promise<{ ok: boolean; aiReport: GuinAiReport | null }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, aiReport: null };
  const note = params.note?.trim().slice(0, 300) || null;

  const nodes = await listGuinNodes(params.map.id);
  const node = nodes.find((item) => item.id === params.participantId);
  if (!node) return { ok: false, aiReport: null };

  const aiReport = buildGuinReport({
    participantId: node.id,
    participantNickname: node.nickname,
    role: node.role,
    score: node.score ?? 0,
    status: params.status,
    conversationPrompt: node.conversationPrompt,
  });

  const { error } = await db
    .from("lr_guin_relationships")
    .update({
      context_status: params.status,
      context_note_sealed: note ? seal({ g: "guin-note", text: note } satisfies SealedNote) : null,
      ai_report_json: aiReport,
      ai_report_version: GUIN_TEMPLATE_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("map_id", params.map.id)
    .eq("participant_id", params.participantId);
  if (error) throw databaseError("관계 상태 저장", error);
  return { ok: true, aiReport };
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

/**
 * 유료 상세로 넘어갈 때만 여는 생년월일 — 주인과 그 한 사람.
 *
 * 참여자의 생년월일은 봉인 저장이라 화면에 온 적이 없다. 이 함수는 그 규칙의
 * 유일한 예외이고, 부르는 자리는 하나다(api/guin/[token]/carry/[id]).
 * **주인 키 확인은 호출부가 한다** — 여기서는 열기만 한다.
 */
export async function carryBirthForReading(
  map: GuinMapRow,
  participantId: string
): Promise<{
  me: GuinBirthInput | null;
  partner: GuinBirthInput | null;
  partnerNickname: string;
} | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_guin_participants")
    .select("id,nickname,birth_sealed")
    .eq("map_id", map.id)
    .eq("id", participantId)
    .maybeSingle();
  if (error) throw databaseError("리딩 값 전달", error);
  if (!data) return null;

  return {
    me: openBirth(map.ownerBirthSealed),
    partner: openBirth(String(data.birth_sealed)),
    partnerNickname: String(data.nickname),
  };
}

/**
 * 본인 요청 삭제 — 별명과 생년월일이 맞는 참여자를 지운다.
 *
 * 참여자 키가 없는 사람(주인이 대신 넣은 사람)도 스스로 지울 수 있어야 해서
 * 있는 길이다. 확인은 지문으로 한다 — 저장할 때 만든 것과 같은 방식으로
 * 다시 만들어 맞춰 본다. 지도에 공개된 것은 별명뿐이므로 별명만으로는
 * 지워지지 않는다.
 *
 * 지운 행 수를 돌려준다. 0 이면 맞는 기록이 없는 것이다 — 호출부는 그것을
 * "찾지 못했어요" 하나로 답한다(맞히기로 남의 생일을 캐지 못하게).
 */
export async function eraseByFingerprint(
  map: GuinMapRow,
  nickname: string,
  birth: GuinBirthInput
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  // 저장할 때와 **같은 모양**이어야 지문이 맞는다 (joinGuinMap 참고).
  const birthdate = `${birth.year}-${birth.month}-${birth.day}`;
  const fingerprint = participantFingerprint(map.id, birthdate, nickname);
  const { data, error } = await db
    .from("lr_guin_participants")
    .delete()
    .eq("map_id", map.id)
    .eq("participant_fingerprint", fingerprint)
    .select("id");
  if (error) throw databaseError("본인 요청 삭제", error);
  return data?.length ?? 0;
}
