// 이 파일은 marketing/video/build-character-motion.mjs 가 생성한다. 손으로 고치지 마라.
//
// 어떤 캐릭터가 어떤 표정 영상을 갖고 있는지의 목록이다. 두 등급이 따로 있다.
//
//   safe   public/characters/motion/<캐릭터>/<표정>.mp4         누구에게나
//   adult  public/characters/motion-adult/<캐릭터>/<표정>.mp4   19금을 켠 사람에게만
//
// 파일을 폴더에 넣고 빌드 스크립트를 돌리면 여기에 등록된다. 등급별로 폴더가
// 갈려 있어서, adult 폴더를 통째로 비워도 safe 쪽은 그대로 돈다.

export const CHARACTER_MOTION: Record<string, string[]> = {
};

export const CHARACTER_MOTION_ADULT: Record<string, string[]> = {
};

/**
 * 이 캐릭터의 이 표정을 어디서 틀지. 없으면 null (= 정지 이미지 그대로).
 *
 * 19금을 켠 사람에게는 adult 를 먼저 찾고, 그 표정이 adult 에 없으면 safe 로
 * 내려온다 - 성인 등급을 한 표정만 만들어 넣어도 나머지가 빈칸이 되지 않는다.
 */
export function characterMotionSrc(
  characterId: string,
  emotion: string,
  adult: boolean
): string | null {
  if (adult && CHARACTER_MOTION_ADULT[characterId]?.includes(emotion)) {
    return `/characters/motion-adult/${characterId}/${emotion}.mp4`;
  }
  if (CHARACTER_MOTION[characterId]?.includes(emotion)) {
    return `/characters/motion/${characterId}/${emotion}.mp4`;
  }
  return null;
}

/** 표정을 못 찾았을 때 대신 틀 것 — 같은 캐릭터의 평온 클립. */
export function characterMotionFallback(characterId: string, adult: boolean): string | null {
  return characterMotionSrc(characterId, "idle", adult);
}

export function hasAnyCharacterMotion(characterId: string, adult: boolean): boolean {
  if (adult && (CHARACTER_MOTION_ADULT[characterId]?.length ?? 0) > 0) return true;
  return (CHARACTER_MOTION[characterId]?.length ?? 0) > 0;
}
