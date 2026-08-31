# 귀인지도 오프닝 — Higgsfield 생성 프롬프트

지시문의 Clip A/B/C 를 **한 번의 생성**으로 합쳤다. 이유는 아래 "왜 한 클립인가".

## 모델·설정 (실제 사용값)

```
model:        seedance_2_5  (Bytedance Seedance 2.5, text-to-video)
mode:         t2v
aspect_ratio: 9:16
duration:     6 (초)
resolution:   720p
generate_audio: false      ← 오프닝은 무음이다. 켜면 크레딧만 더 든다.
```

## 왜 한 클립인가

지시문은 A/B/C 세 클립을 각각 생성하고 이어 붙이라고 한다. 그런데
seedance_2_5 는 한 번에 4~30초를 만든다. 세 번 부르면 크레딧이 세 배로 들고,
클립 사이의 색감·중앙 위치가 어긋날 위험도 오히려 커진다(각각 다른 시드).

그래서 세 장면을 **하나의 연속 카메라 무브**로 적어 한 번에 뽑고, 장면 전환은
웹앱이 재생 구간(currentTime)으로 나눈다. 이러면
- 크레딧 1회분
- 색감·중앙 위치가 원천적으로 일관됨 (한 번에 렌더된 한 영상이므로)
- 웹앱에서 구간을 조절해 4~6초 사이를 자유롭게 맞춤

## 본 프롬프트 (실제 전송값)

```
Premium cinematic mystical relationship map opening for a Korean mobile web app,
vertical 9:16 composition, dark navy-black background, elegant indigo and warm
rose-gold light, refined editorial visual language, calm emotional atmosphere,
physically coherent light, high contrast center composition, empty negative space
in the center for HTML overlays.

The shot is one continuous unbroken camera move in three beats.
Beat one: a nearly black deep navy void. One tiny warm rose-gold point of light
appears exactly at the center and gently pulses once, releasing a very thin
luminous thread. Camera makes a very slow push-in toward the center.
Beat two: the thread expands into an elegant circular constellation map unfolding
from the center, like a celestial parchment star-chart. Thin glowing paths radiate
outward from a central empty node position. Fine paper grain and star-chart
texture appear on the map surface. Camera gently cranes down into a centered
top-down view.
Beat three: four small soft abstract points of light illuminate one after another
at balanced positions around the center, and thin luminous relationship lines
connect them inward to the center. Each connection emits one soft pulse traveling
from the outer point toward the center. Camera performs a delicate slow orbit of
less than 8 degrees while keeping the center perfectly stable.

The very center stays dark and empty for the entire shot so an HTML layer can sit
on top. Motion is calm, premium, minimal, smooth, and slow throughout.
No readable text, no letters, no numbers, no logo, no faces, no hands,
no UI, no watermark, no borders inside the video.
```

## 네거티브 (지시문 2.3 그대로)

```
readable text, fake Korean letters, random typography, numbers, logo, watermark,
UI labels, interface buttons, face, human portrait, hands, crowded city,
photorealistic people, horror, occult symbols, scary atmosphere, aggressive
flashing, shaky camera, oversaturated neon, excessive particles, duplicated nodes,
broken geometry, warped map, fast zoom, hard cuts, low resolution,
compression artifacts.
```

seedance_2_5 에는 별도 negative 파라미터가 없다. 위 금지 항목은 본 프롬프트
끝에 평서문으로 녹여 넣었다 (no readable text, no logo, …).

## 재생성이 필요할 때

아래를 확인하고 안 맞으면 다시 뽑는다 (지시문 4항 체크리스트).

| 항목 | 통과 기준 |
|---|---|
| 중앙 안정성 | 중앙이 클립 내내 크게 흔들리지 않음 |
| 텍스트 오염 | 읽을 수 있는 가짜 글자·숫자 없음 |
| 색상 | 검은 남색·인디고·로즈 유지 |
| 모션 | 빠른 플래시·멀미 유발 회전 없음 |
| 중앙 여백 | 가운데가 비어 HTML 오버레이가 얹힘 |
| 모바일 | 390px 폭에서 핵심 빛이 보임 |
