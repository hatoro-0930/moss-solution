# moss solution

회로 설계 및 PCB 레이아웃 서비스 홈페이지입니다. 한국어·영어 전환과 PC·모바일 화면을 제공합니다.

- 디자인 검토 사이트: https://moss-solution-design.haeun4243.chatgpt.site/
- 구매한 공식 도메인: **moss-solution.com** — 운영 서버 연결 전
- 문의 수신 주소: **moss.solutions25@gmail.com**

## 현재 상태 — 먼저 읽어주세요

문의폼은 `server/`의 문의 API(`POST /api/inquiries`)로 전송됩니다. 서버가 입력·첨부를 검증한 뒤 [Resend](https://resend.com)로 moss.solutions25@gmail.com에 메일을 보내고, 첨부파일은 메일에 직접 붙습니다. 서버에는 문의 내용이나 파일을 저장하지 않습니다.

- 발송에는 서버 환경변수 `RESEND_API_KEY`(Resend에서 moss-solution.com 도메인 인증 후 발급)와 `MAIL_FROM`이 필요합니다. 키가 없으면 API가 503(`mail_not_configured`)으로 답하고 화면에는 전송 실패 안내가 뜹니다. 가짜 접수 완료는 더 이상 표시하지 않습니다.
- 접수 완료 화면은 서버가 메일 발송을 접수했을 때만 표시됩니다. 상세 동작은 [CONTACT-INTEGRATION.md](CONTACT-INTEGRATION.md)를 보세요.

## 로컬 실행

별도 패키지 설치나 빌드 없이 실행하는 HTML/CSS/JavaScript 사이트입니다. Python 3가 있는 환경에서:

```sh
git clone https://github.com/hatoro-0930/moss-solution.git
cd moss-solution
python3 -m http.server 4173 --directory dist
```

- 홈페이지: http://localhost:4173/
- 문의 페이지: http://localhost:4173/contact.html

파일을 직접 더블클릭하면 ES 모듈이 정상 실행되지 않을 수 있으므로 HTTP 서버를 사용하세요. Python 서버는 로컬 확인용이며 운영 배포용이 아닙니다. Python 서버에는 문의 API가 없어 문의를 보내면 실패 안내가 뜹니다.

문의 전송까지 확인하려면 Node.js 22 이상으로 API 서버를 띄웁니다(설치할 패키지 없음). `MAIL_OUTBOX`를 주면 메일을 보내지 않고 그 폴더에 메일 HTML·정보·첨부파일을 저장합니다.

```sh
HOST=127.0.0.1 PORT=4180 STATIC_DIR=dist MAIL_FROM="moss solution <noreply@moss-solution.com>" MAIL_OUTBOX=outbox node server/server.mjs
node --test "server/test/*.test.mjs"
```

- 사이트와 문의 API: http://127.0.0.1:4180/contact.html
- 서버는 페이지를 연 뒤 3초 안에 보낸 문의를 거절합니다(봇 방지).

이메일 디자인은 별도 서버로 확인할 수 있습니다.

```sh
python3 -m http.server 4174 --directory email
```

http://localhost:4174/preview.html — 가상 문의 정보로 작성한 예시입니다. 실제 이메일 클라이언트 수신 테스트는 개발자가 진행해야 합니다.

## 파일 구조

| 파일 | 역할 |
| --- | --- |
| `dist/index.html` | 메인 페이지와 KO/EN 문구 |
| `dist/contact.html` | 문의폼·접수 완료 화면·첨부 영역 |
| `dist/style.css` | 기본 디자인 |
| `dist/contact.css` | 문의 페이지 스타일 |
| `dist/refinement.css` | 최종 반응형·정렬·줄바꿈 보정. 앞선 CSS 뒤에 로드 |
| `dist/language.js` | 언어 전환과 선택 유지 |
| `dist/contact.js` | 입력 검증·전송 상태·완료 흐름, 서버 오류 코드별 안내 문구 |
| `dist/attachments.js` | 파일 선택·추가·개별 삭제. 전송 전까지 브라우저 메모리에 보관 |
| `dist/file-policy.js` | 첨부 형식·개수·용량 제한 — 브라우저와 서버가 같이 사용 |
| `dist/inquiry-transport.js` | 문의를 `POST /api/inquiries`로 전송. 재전송 시 같은 키로 중복 발송 방지 |
| `dist/assets/` | 사이트 이미지 |
| `email/render-inquiry.mjs` | 서버용 수신 이메일 HTML·텍스트 템플릿 |
| `server/server.mjs` | 문의 API — 요청 제한·중복 방지·발송. `STATIC_DIR`을 주면 사이트도 서빙(로컬용) |
| `server/inquiry.mjs` | 입력값·첨부 개수·용량 검증 |
| `server/files.mjs` | 첨부 내용 검사 — 형식 위장, 실행 파일, Gmail이 막는 형식이 든 ZIP·암호 걸린 ZIP |
| `server/mailer.mjs` | Resend 발송. `MAIL_OUTBOX`면 폴더에 저장 |
| `server/test/` | 서버 테스트 (`node --test`) |
| `CONTACT-INTEGRATION.md` | 문의·첨부·메일 연동 상세 가이드 |
| `HANDOFF.md` | 후속 업무와 완료 기준 |

현재 `dist`는 빌드 결과가 아니라 직접 편집하는 정적 사이트 소스입니다. 빌드 명령으로 삭제하지 마세요. CSS는 위 순서로 누적 적용됩니다.

## 구현된 UI

- About, 기획·회로 설계·PCB 레이아웃 소개, 진행 절차
- 한국어/영어 전환과 localStorage 선택 유지
- 필수 입력 검증, 문의 유형 선택, 전송 중 버튼 잠금, 오류·완료 화면
- 다중 파일 선택, 추가 선택, 삭제, 중복 및 형식·개수·용량 검사
- 첨부 한도: 10개 / 개별 10 MiB / 합계 20 MiB (Resend 한도 40 MB는 base64 인코딩 후 기준이라 여유 있음)
- 수신 이메일 템플릿과 첨부파일 목록 표시
- 서버 접수·메일 발송·첨부 전달, 서버 검증 실패·발송 실패 시 이유 안내와 입력 유지

외부 Google Fonts에서 Space Grotesk와 Noto Sans KR을 불러옵니다. 네트워크 접근이 제한된 운영 환경에서는 폰트 제공 방식을 검토하세요.

## 배포와 소스 관리

운영 사이트 https://moss-solution.com 은 사내 서버(k3s)에서 별도 배포 리포로 배포합니다. nginx가 `dist/`를 웹 루트로 제공하고(`/contact` → `contact.html`, www·http는 대표 주소로 리다이렉트), `/api/`는 `server/server.mjs`로 넘깁니다. 메일 키는 서버의 비밀 저장소에만 둡니다.

**운영 배포는 `cluster` 브랜치 기준입니다.** 배포할 때 GitHub의 `cluster` 브랜치에서 파일을 꺼내므로, push하지 않은 변경은 배포되지 않습니다. `main`은 처음 인계받은 디자인 소스입니다.

**GitHub에 push해도 운영 사이트가 자동으로 바뀌지 않습니다.** 배포 리포에서 배포해야 반영됩니다. 기존 ChatGPT Sites 디자인 검토 주소도 자동 업데이트되지 않습니다.

공개 저장소에는 인증키·실제 고객 문의·첨부파일·도메인 계정 정보를 올리지 마세요. 상세 후속 작업은 [HANDOFF.md](HANDOFF.md)를 확인하세요.
