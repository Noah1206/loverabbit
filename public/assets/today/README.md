# 오늘의 사주 액션 — 토끼 (2026-09-01)

흐름마다 **투명 배경 영상(webm) + 정지 그림(webp)** 한 쌍씩.

```
rabbit-hello       손 흔들며 인사       첫 걸음 · 빈 상태
rabbit-bigyeop     두 손 펼침           비겁 — 몫을 나누는 날
rabbit-siksang     입 벌리고 말하는 중   식상 — 표현하는 날
rabbit-jaeseong    턱에 손, 세어보는 중  재성 — 헤아리는 날
rabbit-gwanseong   손가락 하나 세움      관성 — 하나만 정하는 날
rabbit-inseong     귀 처지고 졸린 눈     인성 — 쉬고 채우는 날
```

## 왜 흐름마다 다른가

토끼가 "반응한다"고 느껴지려면 오늘이 어떤 날인지에 따라 모습이 달라져야
한다. 한 장으로 돌려 쓰면 움직이는 장식이지 반응이 아니다. 어느 것이 어느
흐름에 붙는지는 `src/lib/daily-action.ts` 의 `FLOW_RABBIT` 이 정한다 —
파일명을 바꾸면 그쪽도 같이 고쳐야 한다.

## 만드는 길

```
1. nano_banana_pro 로 정지 그림           2크레딧
   → welcome-rabbit.webp 를 image_references 로 넣어 같은 얼굴 유지
2. seedance_2_5 로 4초 영상               10크레딧
   → 그 정지 그림을 start_image 로. 카메라 고정·배경 정지를 프롬프트에 못박는다
3. remove_background (media_type: video)  → 배경이 순수 검정인 mp4
4. ffmpeg 로 밝기를 알파로:

   ffmpeg -i in.mp4 -filter_complex \
   "[0:v]format=gbrp,split[c][m];\
    [m]colorchannelmixer=rr=.30:rg=.59:rb=.11:gr=.30:gg=.59:gb=.11:br=.30:bg=.59:bb=.11,\
    curves=all='0/0 0.06/0 0.16/1 1/1'[a];\
    [c][a]alphamerge,format=yuva420p,scale=448:448,fps=12" \
   -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 \
   -b:v 120k -maxrate 200k -bufsize 500k -an out.webm
```

**colorkey 를 쓰지 마라.** 처음에 그렇게 했다가 테두리에 검은 실밥이
남았다 — colorkey 는 "이 색이면 투명"이라는 이분법이라, 경계의 반투명
픽셀(안티에일리어싱된 털 끝)이 검정과 섞인 채 그대로 남는다.

대신 밝기를 알파로 쓴다. 검정 매트 위의 그림이니 밝을수록 불투명하다.
`curves` 로 0.06 아래는 완전 투명, 0.16 위는 완전 불투명으로 밀고 그
사이만 부드럽게 남기면 경계가 살아난다.

## 크기

448px, 12fps, 120k. 화면에서는 240px 폭(`.today-rabbit`)으로 그린다 —
캐릭터가 프레임 가운데 70% 정도만 차지해서 실제로 그려지는 건 180px
남짓이라 이 해상도로 충분하다. **320px 로 뽑았다가 뭉개진 적이 있다**,
화면 크기보다 작게 만들지 마라.

`ffprobe` 가 `pix_fmt=yuv420p` 로 보고해도 정상이다 — WebM 은 알파를 별도
채널로 담아서 `alpha_mode=1` 태그로 확인해야 한다.

## 소품을 들리지 마라

배경제거기는 토끼가 **들고 있는 물건을 배경으로 오인해 지운다.** 처음에
재성은 수첩을, 인성은 컵을 들고 있었는데 둘 다 그 자리에 구멍이 뚫렸다.
지금 여섯 자세 전부 빈손인 이유가 이것이다. 새 자세를 만들 때 프롬프트에
"holds nothing, no props" 를 넣어라.

## 화면에서

정지 그림을 깔고 그 위에 영상을 덮는다 (`.today-rabbit`). 영상이 오면 그림은
가려지고, VP9 알파가 안 되는 브라우저나 자동재생이 막힌 곳에서는 그림이 그대로
남는다. `poster` 를 쓰지 않는 이유는 poster 가 "재생 가능한데 아직 안 튼"
경우만 그려서, 코덱 자체가 없으면 빈칸이 되기 때문이다.
