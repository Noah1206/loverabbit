# 오행 엠블럼 (2026-09-02)

다섯 장. 240x240 투명 webp, 합쳐 40KB.

```
mok.webp    새싹      목
hwa.webp    불꽃      화
to.webp     흙더미    토
geum.webp   은괴      금
su.webp     물방울    수
```

힉스필드 nano_banana_pro, 소프트 3D — 토끼·오방기와 같은 세계관이다.
**목(새싹) 한 장을 먼저 만들고 image_references 로 넣어 나머지를 맞췄다.**
따로 만들면 질감·조명·크기가 제각각이 된다 (오방기에서 겪었다).

배경 제거는 remove_background (media_type: image). png 는 진짜 알파가
담겨 오므로 마스크를 다시 만들지 말고 그대로 쓴다.

/today 의 "오행의 균형"이 쓴다 — 고리 그래프를 걷고 이 다섯이 줄지어
선다. 개수는 숫자로, 많은 오행은 크기와 바탕색으로, 0 인 오행은
흐림+회색조로 갈린다. 어느 그림이 어느 오행인지는
src/lib/saju-profile.ts 의 ELEMENT_ART 가 정한다.
