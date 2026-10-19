# moss solution

회로 설계 및 PCB 레이아웃 서비스 홈페이지입니다. 한국어·영어 전환과 PC·모바일 화면을 제공합니다.

- 디자인 검토 사이트: https://moss-solution-design.haeun4243.chatgpt.site/
- 구매한 공식 도메인: **moss-solution.com** — 운영 서버 연결 전
- 문의 수신 주소: **moss.solutions25@gmail.com**

## 현재 상태 — 먼저 읽어주세요

**프런트엔드 UI는 구현되어 있으나 실제 문의 접수·이메일 발송·파일 업로드는 구현되지 않았습니다.**
`dist/inquiry-transport.js`는 항상 성공을 반환하는 모의 어댑터입니다. 화면에 접수 완료가 표시되어도 데이터가 저장되거나 메일이 발송되지 않습니다. 실제 고객 접수용으로 운영하기 전에 반드시 서버 API로 교체해야 합니다.

## 로컬 실행

별도 패키지 설치나 빌드 없이 실행하는 HTML/CSS/JavaScript 사이트입니다. Python 3가 있는 환경에서:

```sh
git clone https://github.com/hatoro-0930/moss-solution.git
cd moss-solution
python3 -m http.server 4173 --directory dist
```

- 홈페이지: http://localhost:4173/
- 문의 페이지: http://localhost:4173/contact.html

파일을 직접 더블클릭하면 ES 모듈이 정상 실행되지 않을 수 있으므로 HTTP 서버를 사용하세요. Python 서버는 로컬 확인용이며 운영 배포용이 아닙니다.

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
| `dist/contact.js` | 입력 검증·전송 상태·완료 흐름 |
| `dist/attachments.js` | 파일 선택·추가·개별 삭제. 브라우저 메모리에만 보관 |
| `dist/file-policy.js` | 첨부 형식·개수·용량 제한 |
| `dist/inquiry-transport.js` | **실제 서버 API로 교체할 위치** |
| `dist/assets/` | 사이트 이미지 |
| `email/render-inquiry.mjs` | 서버용 수신 이메일 HTML·텍스트 템플릿 |
| `CONTACT-INTEGRATION.md` | 문의·첨부·메일 연동 상세 가이드 |
| `HANDOFF.md` | 후속 업무와 완료 기준 |

현재 `dist`는 빌드 결과가 아니라 직접 편집하는 정적 사이트 소스입니다. 빌드 명령으로 삭제하지 마세요. CSS는 위 순서로 누적 적용됩니다.

## 구현된 UI

- About, 기획·회로 설계·PCB 레이아웃 소개, 진행 절차
- 한국어/영어 전환과 localStorage 선택 유지
- 필수 입력 검증, 문의 유형 선택, 전송 중 버튼 잠금, 오류·완료 화면
- 다중 파일 선택, 추가 선택, 삭제, 중복 및 형식·개수·용량 검사
- 초기 첨부 한도: 10개 / 개별 10 MiB / 합계 20 MiB
- 수신 이메일 템플릿과 첨부파일 목록 표시

외부 Google Fonts에서 Space Grotesk와 Noto Sans KR을 불러옵니다. 네트워크 접근이 제한된 운영 환경에서는 폰트 제공 방식을 검토하세요.

## 배포와 소스 관리

운영 서버는 `dist/`만 웹 루트로 제공하세요. `/contact`를 사용할 경우 `contact.html`로 매핑하고, 기존 `.html` 링크도 처리해야 합니다. 서버 API와 HTTPS는 별도 구성해야 합니다.

이 저장소는 디자인 검토 사이트의 최종 소스를 인계한 독립 저장소입니다. **GitHub에 push해도 기존 ChatGPT Sites 주소가 자동 업데이트되지는 않습니다.** 자동 배포가 필요하면 운영 호스팅을 결정한 뒤 설정하세요.

공개 저장소에는 인증키·실제 고객 문의·첨부파일·도메인 계정 정보를 올리지 마세요. 상세 후속 작업은 [HANDOFF.md](HANDOFF.md)를 확인하세요.
