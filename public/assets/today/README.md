# 오늘의 사주 액션 — 토끼 (2026-09-01)

여섯 장. 전부 512x512 webp, 장당 5~7KB.

rabbit-hello.webp      손 흔들며 인사. 첫 걸음과 빈 상태(로그인·프로필 안내)가 쓴다.
rabbit-bigyeop.webp    두 손 펼침 — 몫을 나누는 날
rabbit-siksang.webp    입 벌리고 말하는 중 — 표현하는 날
rabbit-jaeseong.webp   수첩 들고 확인 — 세어보는 날
rabbit-gwanseong.webp  손가락 하나 세움 — 하나만 정하는 날
rabbit-inseong.webp    컵 들고 쉬는 중, 귀가 처짐 — 채우는 날

## 흐름마다 다른 얼굴인 이유

토끼가 "반응한다"고 느껴지려면 오늘이 어떤 날인지에 따라 모습이 달라져야
한다. 한 장으로 돌려 쓰면 움직이는 장식이지 반응이 아니다. 어느 그림이
어느 흐름에 붙는지는 `src/lib/daily-action.ts` 의 `FLOW_RABBIT` 이 정한다 —
파일명을 바꾸면 그쪽도 같이 고쳐야 한다.

## 같은 토끼여야 한다

Higgsfield nano_banana_pro, 2크레딧/장. 여섯 장 전부
`public/assets/home/welcome-rabbit.webp` 를 image_references 로 넣어
같은 얼굴·같은 귀·같은 볼터치·같은 렌더링을 유지했다. **새로 만들 때도
그 레퍼런스를 넣어라** — 빼면 얼굴이 미묘하게 달라져서, 걸음을 넘길 때
다른 토끼로 바뀐 것처럼 보인다.

## 배경

연보라 단색(#c9b6e8 언저리)이고 여백이 넉넉하다. 화면에서 object-fit:
contain 으로 얹으므로 캐릭터가 프레임에 꽉 차면 안 된다 — 위아래가 잘린다.
