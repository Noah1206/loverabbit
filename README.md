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

## DB 연결

Supabase 프로젝트 `project1`에 아래 서버 전용 테이블과 RLS 정책이 구축돼 있습니다.

- `lr_users`: 이메일 가입·생년월일·마케팅 동의
- `lr_readings`: 생성된 리딩 원문·지수·해금 상태
- `lr_orders`: 단품 리딩 주문과 결제 상태

Supabase 대시보드의 **Project Settings → API Keys**에서 Secret key를 확인한 뒤 `.env.local`에 설정하세요. 이 키는 브라우저에 노출하면 안 되므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

```dotenv
SUPABASE_URL=https://uaaxqqzdfmuzzwgqsdki.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
READING_SECRET=충분히-긴-임의-문자열
```

스키마 변경 이력은 `supabase/migrations/`에 있습니다. 키가 없는 로컬 개발 환경에서는 `data/readings/` 파일 저장소가 보조 경로로 동작하지만, 운영 환경은 DB 연결이 없으면 저장·가입·결제를 거부합니다.

### 마이그레이션 (Supabase CLI)

대시보드 SQL Editor에 직접 붙여넣으면 순서가 어긋나거나 한 건이 누락되기 쉽습니다.
실제로 `20260818031752`가 빠져 대화권 결제가 죽어 있었던 적이 있으므로, 앞으로는 CLI로 일괄 적용합니다.

최초 1회 설정:

```bash
npm run db:login          # 브라우저 인증
npm run db:link           # 프로젝트 uaaxqqzdfmuzzwgqsdki 연결 (DB 비밀번호 입력)
```

이후 사용:

```bash
npm run db:status                 # 로컬 / 원격 적용 상태 비교
npm run db:new -- add_something   # 새 마이그레이션 파일 생성
npm run db:push                   # 원격에 미적용분만 순서대로 적용
```

> **주의 — 링크 직후 `db:push`를 바로 실행하지 마세요.**
> 기존 마이그레이션은 대시보드에서 수동 적용돼 CLI 장부(`supabase_migrations.schema_migrations`)에
> 기록이 없습니다. 이 상태로 push하면 전부 재실행되고, `20260817210211_user_profiles_theme.sql`은
> `create table`에 `if not exists`가 없어 실패합니다.
> 먼저 아래로 "이미 적용됨"만 기록한 뒤 사용하세요.

```bash
npx -y supabase@latest migration repair --status applied \
  20260817080119 20260817080221 20260817081757 20260817095653 20260817100748 \
  20260817110917 20260817122209 20260817123037 20260817125108 20260817210211 \
  20260817235031 20260818023133 20260818023308 20260818031752 20260818081500
```

## 구조

| 경로 | 역할 |
|---|---|
| `src/app/page.tsx` | 랜딩 (후킹 카피 + CTA) |
| `src/app/reading/page.tsx` | 사주 입력 폼 + 무료 티저 + 페이월 + 공유 이미지 생성 |
| `src/app/api/reading/route.ts` | 간지 계산 → AI 리딩 생성·DB 저장, 티저만 응답 |
| `src/app/api/unlock/route.ts` | 결제 승인·주문 기록 후 풀 리딩 해금 |
| `src/lib/database.ts` | 사용자·주문 DB 접근 계층 |
| `src/lib/store.ts` | Supabase 리딩 저장소 + 로컬 파일 폴백 |
| `src/lib/saju.ts` | 60갑자 연주·월주·일주·시주 계산 |

## 배포

Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `READING_SECRET`을 설정한 뒤 배포합니다: `npx vercel --prod`

## 런칭 전 필수 체크리스트 (법적)

1. **성인인증**: 체크박스 동의만으로는 청소년보호법 위반. 포트원(아임포트) PASS 본인인증 연동 후 유료화할 것. 미이행 시 방심위 시정요구·과태료 + 결제사 가맹 거절.
2. **결제**: 토스페이먼츠 가맹 심사 시 성인 콘텐츠 여부를 정직하게 신고할 것 (수위가 '19금 컨셉 운세' 수준이면 통과 사례 많음, 노골적 음란물은 거절).
3. **통신판매업 신고** + 사업자등록 (유료화 시점).
4. 앱스토어/플레이스토어는 성적 콘텐츠 금지 → **웹 전용 유지**, 앱은 수위 낮춘 버전만.

자세한 실행 계획은 `ROADMAP.md` 참고.
