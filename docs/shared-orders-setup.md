# 공유 수주대장 연결

공유 대상은 수주대장입니다. 지출·작업일보·거래처·납품실적은 기존처럼 해당 브라우저에 저장됩니다.

## Google Sheets 연결

1. 홈페이지용 비공개 Google Sheets를 만들고 수주대장 탭에 google-apps-script/Code.gs의 CJENG_HEADERS와 같은 12개 열을 준비합니다. 내부ID는 변경하지 않습니다. 원본 CSV와 비밀키는 저장소에 넣지 않습니다.
2. 이 시트의 확장 프로그램 → Apps Script에서 Code.gs와 appsscript.json을 복사하고 setupWorkspace를 한 번 실행합니다. 스크립트 속성에 시트 ID와 연결 비밀키가 생성됩니다.
3. 웹 앱을 소유자 권한으로 실행하도록 배포합니다. 서버가 호출할 수 있도록 접속 범위는 모든 사용자로 설정하되, 데이터 조회·저장은 HMAC 서명과 60초 유효기간 및 일회용 nonce를 검증한 요청만 처리합니다. 일반 GET 요청에는 자료가 나오지 않습니다. 시트 자체는 비공개로 유지합니다.
4. Google OAuth 웹 클라이언트의 승인된 JavaScript 원본에 홈페이지 주소를 등록합니다. Google ID 토큰으로 직원을 확인하므로 OAuth client secret과 redirect URI는 사용하지 않습니다.
5. Vercel Production에 아래 서버 환경변수를 설정합니다. 비밀값은 Secret으로 저장합니다.
   - GOOGLE_CLIENT_ID: Google 웹 클라이언트 ID
   - WORKSPACE_ORIGIN: 홈페이지의 정확한 HTTPS origin
   - WORKSPACE_ALLOWED_EMAILS: 허용할 직원 이메일을 쉼표로 구분
   - WORKSPACE_SESSION_SECRET: 암호학적으로 생성한 32자 이상의 임의 비밀값
   - WORKSPACE_STORAGE=sheets
   - WORKSPACE_SHEETS_ENDPOINT: 실제 배포된 https://script.google.com/macros/s/…/exec 주소
   - WORKSPACE_SHEETS_SECRET: 스크립트 속성의 CJENG_API_SECRET
6. 실제 서명 요청으로 시트 조회와 충돌 처리를 확인한 뒤 VITE_SHARED_ORDERS=true로 빌드·배포합니다. 허용 계정 로그인, 비허용 요청 차단, 저장 및 다른 창의 갱신을 확인합니다.

직원은 홈페이지에 로그인하면 됩니다. 시트에 직접 접근할 권한을 줄 필요는 없습니다. 직원 추가·제거 시 허용 목록을 수정하고 재배포합니다. 목록은 매 API 요청마다 확인합니다.

## 기존 자료와 연결

2023~2026년 CSV의 기준 건수는 연도별 43 / 26 / 24 / 26건, 총 119건입니다. 수주일자가 없는 4건은 빈 값으로 보존합니다. 공용 데이터에는 기본 예제 자료를 자동으로 추가하지 않습니다.

시트가 비어 있을 때만 홈페이지의 브라우저 자료 가져오기를 사용할 수 있습니다. 공용 데이터가 이미 있으면 연도와 수주번호가 같은 로컬 자료의 내부ID를 공용ID로 연결하여 같은 브라우저의 지출·작업일보 연결을 유지합니다. 서로 일치하지 않는 로컬 자료는 삭제하지 않습니다.

## 저장과 동시 수정

수주 데이터는 서버 인증 후에만 조회·변경됩니다. 세션은 HttpOnly·Secure 쿠키에 저장됩니다. 수정·상태 일괄 변경·CSV 가져오기·삭제는 서버 저장 성공 후 완료되며, 서버 장애 시 로컬 저장으로 자동 전환하지 않습니다.

Apps Script의 ScriptLock 안에서 현재 시트 내용의 SHA-256 revision을 비교하고 기록합니다. 오래된 자료로 저장하면 409 충돌을 반환합니다. 수정 내용을 복사해 두고 수정 창을 닫은 뒤 다시 열어 최신 자료에 반영합니다. 목록은 창 포커스 복귀와 화면이 보이는 동안 10초 간격으로 갱신됩니다. 시트를 직접 편집한 변경도 다음 조회에 반영되므로 12열 구조와 날짜 형식을 유지해야 합니다.

공유 연결을 끄려면 VITE_SHARED_ORDERS=false로 재배포합니다. 이 경우 기존 브라우저 저장 방식으로 돌아가며 공용 시트의 내용을 로컬로 자동 복사하지 않습니다.

## 선택 가능한 Postgres 저장소

기존 Postgres 어댑터도 유지됩니다. WORKSPACE_STORAGE=postgres, DATABASE_URL을 설정하고 npm run db:init로 전용 테이블을 준비할 수 있습니다. Sheets와 Postgres 사이의 자료 복사는 자동으로 수행하지 않습니다.
