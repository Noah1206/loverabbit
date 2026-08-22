성인 등급 표정 클립을 넣는 곳입니다.

넣는 방법
---------
public/characters/motion-adult/<캐릭터>/<표정>.mp4

  예) public/characters/motion-adult/hongryeon/tease.mp4
      public/characters/motion-adult/jawol/shy.mp4

캐릭터 폴더 이름 (11개)
  hwarin      화린도령
  hongryeon   홍련신녀
  mukyeon     묵연도령
  jawol       자월신녀
  geumya      금야도령
  maehwa      매화아씨
  cheongsa    청사도령
  bihwa       비화신녀
  haewol      해월도령
  yeonhwa     연화아씨
  jeokya      적야도령

표정 파일 이름 (8개)
  idle.mp4      평온
  shy.mp4       부끄러움
  laugh.mp4     웃음
  tease.mp4     유혹
  disgust.mp4   극혐
  sulk.mp4      삐짐
  surprise.mp4  놀람
  sad.mp4       슬픔

넣은 뒤 한 번만
---------------
  node marketing/video/build-character-motion.mjs

이러면 src/lib/character-motion.ts 목록이 다시 쓰이고, 19금을 켠 사람에게만
그 클립이 나갑니다. 다 채울 필요 없습니다 - 없는 표정은 일반 등급으로 내려갑니다.

권장 규격: 3:4 세로, 540x720 안팎, 소리 없음(mp4/h264). 다른 크기도 재생은 됩니다.
