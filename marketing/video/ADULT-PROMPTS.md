# 성인 등급 표정 클립 만들기

일반 등급 프롬프트는 `animate-emotions.mjs` 안에 들어 있지만,
성인 등급 프롬프트는 이 저장소에 없다. 직접 써서 파일로 준다.

## 1. 틀 복사

    cp marketing/video/adult-prompts.example.json marketing/video/adult-prompts.json

`adult-prompts.json` 은 git 에 올라가지 않는다 (.gitignore 등록됨).

## 2. 채우기

원하는 캐릭터·표정만 채우면 된다. 빈 문자열("")로 둔 항목은 건너뛴다.

    {
      "hongryeon": {
        "tease": "여기에 프롬프트",
        "shy":   "여기에 프롬프트"
      }
    }

캐릭터 11: hwarin hongryeon mukyeon jawol geumya maehwa cheongsa bihwa haewol yeonhwa jeokya
표정 8:    idle shy laugh tease disgust sulk surprise sad

프롬프트를 쓸 때 같이 넣으면 결과가 안정적인 것들:

- 원본 이미지의 얼굴·머리·의상·배경을 그대로 유지하라는 지시
- 같은 그림체, 같은 색감, 같은 프레이밍(줌·컷 없음)
- 카메라 고정 — 표정 클립은 대사마다 갈아 끼우므로 컷이 튀면 안 된다
- 3초 안에 끝나는 동작 하나

## 3. 생성

    node marketing/video/animate-emotions.mjs --tier adult --prompts marketing/video/adult-prompts.json
    # 견적만 나온다. 실제로 만들려면 --yes 를 붙인다.

    node marketing/video/animate-emotions.mjs --tier adult --prompts marketing/video/adult-prompts.json --yes

결과는 `marketing/video/emotions-raw-adult/<캐릭터>__<표정>.mp4` 로 떨어진다.

## 4. 등록

    npm run motion:build

압축해서 `public/characters/motion-adult/<캐릭터>/<표정>.mp4` 로 옮기고 목록을 다시 쓴다.
커밋 후 푸시하면 배포 빌드가 목록을 한 번 더 갱신한다.

## 다른 도구로 만든 경우

힉스필드를 안 쓰고 만든 파일이어도 상관없다. 둘 중 아무 자리에나 넣으면 된다.

    marketing/video/emotions-raw-adult/<캐릭터>__<표정>.mp4   압축까지 맡길 때
    public/characters/motion-adult/<캐릭터>/<표정>.mp4        이미 완성된 파일일 때

권장 규격: 3:4 세로, 540x720 안팎, 무음, h264 mp4.
