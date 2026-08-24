# 포트원 V2 · KG이니시스 실시간 계좌이체

이 브랜치는 포트원 V2의 KG이니시스 채널로 `TRANSFER` 결제를 요청합니다. 브라우저의
성공 응답은 결제 확정에 사용하지 않으며, 서버가 포트원 결제 건을 다시 조회해 상점,
금액, 통화, 결제수단, PG사를 대조한 뒤 리딩 또는 대화권을 지급합니다.

## 운영 설정

1. 포트원 콘솔에서 KG이니시스 V2 채널을 만들고 실시간 계좌이체를 활성화합니다.
2. Vercel의 Preview 환경에 아래 네 값을 먼저 설정합니다.
   - `NEXT_PUBLIC_PORTONE_STORE_ID`
   - `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
   - `PORTONE_API_SECRET`
   - `PORTONE_WEBHOOK_SECRET`
3. 포트원 콘솔의 웹훅 URL을 `https://<도메인>/api/portone/webhook`으로 등록합니다.
4. `supabase/migrations/20260824160323_add_portone_payment_method.sql`을 Preview DB에 적용합니다.
5. 포트원의 테스트 채널로 리딩 결제와 대화권 결제를 각각 1회 확인합니다.

포트원 공개 설정 두 값이 있으면 화면은 포트원 결제를 최우선으로 사용합니다. 설정이
없으면 기존 수동 계좌이체, 그마저 없으면 기존 토스페이먼츠 순서로 폴백합니다.

## 확인해야 할 흐름

- 결제 취소/실패 시 권리가 지급되지 않는지
- 결제 금액을 변경한 요청이 서버에서 거절되는지
- 결제 성공 후 리딩 전문이 열리는지
- 결제 성공 후 대화권이 정확히 한 번만 충전되는지
- 웹훅과 성공 화면이 동시에 호출돼도 중복 지급되지 않는지

## main 반영

Preview 검증이 끝나면 작업 브랜치를 최신 `main`에 맞춘 뒤 PR로 병합합니다.

```bash
git switch feature/portone-inicis-transfer
git fetch origin
git rebase origin/main
git push -u origin feature/portone-inicis-transfer
```

PR 검증이 끝난 뒤 GitHub에서 `main`으로 병합하고, Production 환경 변수와 DB 마이그레이션을
반영합니다. 운영 DB 마이그레이션은 Preview 결제 검증 전에 먼저 적용하지 않습니다.
