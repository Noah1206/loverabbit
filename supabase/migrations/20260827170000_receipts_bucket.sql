-- 이체 화면 캡처를 담는 비공개 버킷.
--
-- 입금 확인 요청을 눌렀는데 통장에 없는 건이 많았다. 손님이 이체 완료 화면을
-- 올리면 운영자가 텔레그램에서 그 사진을 보고 바로 승인할 수 있다.
-- 사진에는 이름·계좌가 찍혀 있으므로 공개하지 않는다. 서버(service_role)만 읽는다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lr-receipts', 'lr-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;
