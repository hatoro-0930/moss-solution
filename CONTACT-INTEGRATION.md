# 문의 접수·메일 발송

## 흐름

1. `dist/contact.js`가 입력을 검증하고 `dist/inquiry-transport.js`의 `submitInquiry(payload)`를 호출합니다.
2. `submitInquiry`가 `POST /api/inquiries`로 multipart/form-data를 보냅니다.
   필드: `name`, `company`, `email`, `service`(planning/circuit/layout/both/discuss), `message`, `schedule`, `language`(ko/en),
   `moss_check`(사람에게 보이지 않는 봇 확인 칸), `elapsed`(페이지를 연 뒤 지난 ms), `key`(중복 방지 키), `attachments`(파일마다 반복).
3. `server/server.mjs`가 검증한 뒤 `email/render-inquiry.mjs`로 메일을 만들어 [Resend](https://resend.com/docs/api-reference/emails/send-email)로 보냅니다. 첨부파일은 메일에 직접 붙습니다. 서버에는 아무것도 저장하지 않습니다.
4. Resend가 발송을 접수했을 때만 `{ "ok": true, "id": "MS-…" }`를 돌려주고, 그때만 완료 화면이 뜹니다. 수신함 도착 자체를 보장하는 응답은 아니므로 전달 상태는 Resend 대시보드에서 확인합니다.

## 메일

- 받는 주소: moss.solutions25@gmail.com — 서버(`render-inquiry.mjs`)에 고정. 클라이언트가 정할 수 없습니다.
- 보내는 주소(From): `MAIL_FROM` — Resend에서 인증한 moss-solution.com 주소(예: `moss solution <noreply@moss-solution.com>`).
  받는 주소와 같은 Gmail 주소로 보내면 Gmail이 Reply-To를 무시하고 답장을 자기 자신에게 보내는 사례가 있어 다른 주소를 씁니다.
- Reply-To: 검증한 문의자 이메일 — Gmail에서 «답장»을 누르면 문의자에게 갑니다.
- 제목: `[moss 문의] {문의 유형} | {회사 · }{이름}`. HTML과 텍스트 본문을 함께 보내고, 입력값은 HTML 이스케이프합니다.
- 문의 번호: `MS-YYYYMMDD-XXXXXX` (한국시간 날짜 + 임의 6자리).
- 고객용 자동 접수 확인 메일은 보내지 않습니다.

## 서버 검증

- 입력: 이름 1–80자, 회사 120자 이하, 이메일 형식·254자 이하(줄바꿈·쉼표 등 헤더 삽입 불가), 유형은 허용값만, 내용 1–5000자, 일정 120자 이하. 줄바꿈을 정리하고 제어 문자를 지웁니다.
- 첨부 규칙: `dist/file-policy.js`의 확장자·최대 10개·파일당 10 MiB·합계 20 MiB를 서버도 그대로 씁니다. 요청 본문이 22 MiB를 넘으면 읽기 전에 거절합니다.
- 첨부 내용(`server/files.mjs`):
  - PDF·PNG·JPG·WebP·ZIP·DOCX·XLSX는 파일 서명이 확장자와 맞아야 합니다. 실행 파일(Windows·Linux·macOS)은 확장자와 관계없이 거절합니다.
  - ZIP은 풀지 않고 목록만 읽습니다. [Gmail이 막는 형식](https://support.google.com/mail/answer/6590)(.exe, .js, .lib 등)이나 암호 걸린 항목이 있으면 거절합니다.
    Gmail은 그런 메일을 통째로 반송해 문의가 조용히 사라지므로, 접수 단계에서 이유를 알려 줍니다. 옛 KiCad 프로젝트의 `*-cache.lib`가 여기 걸립니다.
  - 악성코드 검사는 Gmail의 첨부 검사에 맡깁니다.
- 파일명: 경로, 제어 문자, 확장자를 속이는 방향 제어 문자를 지우고 150자로 줄입니다.

## 응답

화면 안내 문구는 `dist/contact.js`의 `failureMessage()`에 있습니다. 실패해도 입력과 선택한 파일은 그대로 남습니다.

| HTTP | `code` | 뜻 |
| --- | --- | --- |
| 200 | — | 발송 접수(`ok: true`) |
| 400 | `invalid` (+`field`) | 입력값 오류 |
| 400 | `too_fast` | 페이지를 연 뒤 3초 안에 제출(봇 방지) — 다시 보내면 됩니다 |
| 400 | `too_many_files` / `invalid_form` | 첨부 11개 이상 / multipart 해석 실패 |
| 403 | `forbidden_origin` | 다른 사이트 페이지에서 보낸 요청 |
| 413 | `too_large` (+`file`) | 용량 초과 |
| 415 | `unsupported_media_type` | multipart가 아님 |
| 422 | `invalid_file` · `blocked_in_archive` · `encrypted_archive` (+`file`) | 첨부 거절 |
| 429 | `rate_limited` · `daily_limit` | 요청 제한 |
| 502 | `send_failed` | Resend 오류·시간 초과 — 같은 내용으로 다시 보내도 됩니다 |
| 503 | `mail_not_configured` | 서버에 메일 키가 없음 |

## 스팸·과다 요청·중복

- 숨김 칸 `moss_check`가 채워진 요청은 성공처럼 응답하고 버립니다.
- 페이지를 연 뒤 3초 안의 제출, 다른 사이트에서 온 요청(Origin)을 거절합니다.
- 접속 IP(`CF-Connecting-IP`)당 10분에 8번, 전체 하루 80통(Resend 무료 한도 100통 아래)까지 받습니다.
- 브라우저는 같은 내용을 다시 보낼 때 같은 `key`를 씁니다. 서버는 같은 키를 1시간 동안 한 번만 발송합니다(동시에 와도 마찬가지). 발송에 실패한 키는 다시 보낼 수 있습니다.
- 요청 제한과 중복 방지는 메모리에 있어 재시작하면 초기화됩니다. API 서버는 1대로 운영합니다.

## 환경변수

| 이름 | 용도 |
| --- | --- |
| `RESEND_API_KEY` | Resend API 키(발송 권한만). 서버 비밀 저장소에만 둡니다 |
| `MAIL_FROM` | 보내는 주소 |
| `MAIL_TO_OVERRIDE` | 테스트할 때만 받는 주소를 바꿉니다(예: `delivered@resend.dev`) |
| `MAIL_OUTBOX` | 보내지 않고 이 폴더에 저장(로컬 개발) |
| `PORT` / `HOST` | 기본 3000 / 0.0.0.0 |
| `STATIC_DIR` | 사이트 파일도 서빙(로컬 개발). 운영에서는 nginx가 서빙 |

## 로그

접수마다 JSON 한 줄을 남깁니다: `outcome`, 문의 번호, 첨부 개수·용량, 처리 시간, 실패 이유. 이름·이메일·문의 내용·파일명은 남기지 않습니다.

## 남은 검수

- 운영 키를 넣은 뒤 실제 Gmail 수신, 답장 대상, 첨부 열림 확인.
- 개인정보 처리 안내: 수집 항목(이름·회사·이메일·문의 내용·첨부), 목적(문의 응대), 보관 기간, 처리 위탁(Resend — 메일 발송, 발송 기록 30일 보관 / Google — 수신함)과 국외 이전 여부를 소유자와 확정해 폼에 표시해야 합니다.
