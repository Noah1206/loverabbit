# 🐰 러브레빗 (LoveRabbit)

성인(만 19세+) 대상 속궁합·연애운 특화 AI 사주 웹앱 MVP.

## 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

API 키 없이도 데모 모드(목업 리딩)로 전체 퍼널이 동작합니다.
실제 AI 리딩은 `.env`에 `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`(무료 티어) / `OPENAI_API_KEY`(OpenRouter·Groq·Ollama 호환) 중 하나만 넣으면 켜집니다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/app/page.tsx` | 랜딩 (후킹 카피 + CTA) |
| `src/components/AdultGate.tsx` | 성인 확인 게이트 (⚠️ 런칭 전 PASS 본인인증으로 교체 필수) |
| `src/app/reading/page.tsx` | 사주 입력 폼 + 무료 티저 + 페이월 + 공유 이미지 생성 |
| `src/app/api/reading/route.ts` | 간지 계산 → AI 리딩 생성·서버 저장, 티저만 응답 |
| `src/app/api/unlock/route.ts` | 결제 승인(토스) 또는 모의결제 후 풀 리딩 해금 |
| `src/lib/store.ts` | 리딩 파일 저장소 (배포 시 Redis/KV로 교체) |
| `src/lib/saju.ts` | 60갑자 연주·월주·일주·시주 계산 |

## 배포

Vercel 무료 플랜으로 즉시 배포 가능: `npx vercel`

## 런칭 전 필수 체크리스트 (법적)

1. **성인인증**: 체크박스 동의만으로는 청소년보호법 위반. 포트원(아임포트) PASS 본인인증 연동 후 유료화할 것. 미이행 시 방심위 시정요구·과태료 + 결제사 가맹 거절.
2. **결제**: 토스페이먼츠 가맹 심사 시 성인 콘텐츠 여부를 정직하게 신고할 것 (수위가 '19금 컨셉 운세' 수준이면 통과 사례 많음, 노골적 음란물은 거절).
3. **통신판매업 신고** + 사업자등록 (유료화 시점).
4. 앱스토어/플레이스토어는 성적 콘텐츠 금지 → **웹 전용 유지**, 앱은 수위 낮춘 버전만.

자세한 실행 계획은 `ROADMAP.md` 참고.
