# 프론트엔드 설정과 배포

[English](frontend-guide.md) · **한국어**

[프로젝트 소개](../README.ko.md) · [빠른 시작](../README.ko.md#빠른-시작) · [기여 가이드](../CONTRIBUTING.ko.md)

먼저 README의 빠른 시작으로 웹 화면을 실행하세요. 이 문서는 API 설정, 인증, 배포, 개발 명령과 코드 구조를 안내합니다. 명령은 저장소 루트에서 실행합니다.

## 설정

| 환경 변수 | 용도 | 로컬 기본값 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 브라우저가 호출할 백엔드 Origin | 빈 값 |
| `DEVLINK_API_PROXY_TARGET` | Vite 개발 프록시가 연결할 백엔드 주소 | `http://localhost:8080` |

### 로컬 API 연결

`VITE_API_BASE_URL`을 비워두면 브라우저의 `/api` 요청을 Vite가 백엔드로 전달합니다. 로컬 개발에서는 이 프록시를 사용하므로 프론트 주소를 백엔드 CORS에 추가하지 않고 세션 쿠키를 사용할 수 있습니다.

백엔드 포트가 다르면 `DEVLINK_API_PROXY_TARGET`을 변경하고 개발 서버를 다시 실행합니다. 개발 프록시는 전달 시 Origin 헤더를 제거하며, 백엔드의 세션·CSRF 검증은 유지됩니다.

### 운영 배포

배포 환경에서는 `VITE_API_BASE_URL`에 실제 HTTPS 백엔드 Origin을 지정합니다.

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

위 주소는 예시입니다. 실제 주소로 교체하고 **`/api` 또는 `/api/v1`은 붙이지 않습니다.** 공통 API 클라이언트가 경로를 추가합니다.

- `VITE_` 변수는 빌드 결과에 포함되어 공개됩니다. 비밀번호·Agent 토큰을 넣지 마세요.
- 값을 변경하면 다시 빌드·배포해야 합니다.
- `DEVLINK_API_PROXY_TARGET`은 개발 서버 전용입니다. `npm run preview`와 정적 배포에는 적용되지 않습니다.
- 백엔드에는 프론트 Origin에 대한 CORS 허용, 쿠키 포함 요청 허용과 운영 세션 쿠키 설정이 필요합니다. 사이트가 다르면 브라우저의 서드파티 쿠키 정책도 확인하세요.

Vercel 설정은 다음과 같습니다.

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Vite |
| 빌드 명령 | `npm run build` |
| 출력 폴더 | `dist` |
| 환경 변수 | `VITE_API_BASE_URL` |

루트의 [vercel.json](../vercel.json)은 `/tree` 같은 경로의 직접 접속·새로고침을 처리하는 SPA 재작성 설정입니다. 백엔드 API 프록시를 제공하지 않습니다.

### 인증과 연결 토큰

웹 API 요청은 `withCredentials`로 세션 쿠키를 포함하고, 상태 변경 요청 전에 CSRF 토큰을 조회합니다. 새로고침 시 내 정보 API로 로그인 상태를 복원합니다.

비밀번호·세션 식별자·Agent 토큰은 브라우저 저장소에 보관하지 않습니다. 발급한 Agent 토큰은 현재 화면에서 확인·복사하며, 재발급 시 기존 연결이 영향을 받을 수 있으므로 안내를 확인하세요. 화면 설정과 작업 읽음 상태 등은 브라우저에 저장될 수 있습니다.

웹 로그아웃과 Agent 연결 종료는 별개입니다. 두 계정으로 확인할 때는 다른 브라우저나 시크릿 창을 사용해 세션을 분리하세요.

## 개발하기

### 주요 명령

저장소 루트의 명령입니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | TypeScript 검사 후 프로덕션 번들 생성 |
| `npm run preview` | 생성된 번들 미리보기 |
| `npm run lint` | ESLint 검사 |

루트에는 별도의 `npm test` 스크립트가 없습니다. 데스크톱 실행·패키징과 검증 명령은 [데스크톱 개발 문서](../desktop/README.ko.md)에서 안내합니다.

### 코드 구조

```text
src/
├── app/                    # 진입점, 라우팅, 공통 Provider
├── pages/                  # 인증·워크스페이스·의존성 화면
├── features/
│   ├── auth/               # 계정과 세션
│   ├── teams/              # 팀·팀원·초대코드
│   ├── agents/             # Agent 관리와 토큰 발급
│   ├── tasks/              # 작업 목록·대화·실시간 갱신
│   ├── dependency-tree/    # 저장소 의존성과 변경 영향
│   ├── desktop-setup/      # 프로젝트·MCP 연결과 알림
│   ├── workspace/          # 워크스페이스 화면 구성
│   └── team-preview/       # 3D 팀 화면과 디자인 미리보기
├── components/             # 공통 UI
└── lib/                    # 공통 API 클라이언트와 Query Client

desktop/                    # Electron 앱과 Windows 설치 파일 구성
```

공통 Axios 인스턴스·Query Client를 재사용하고, 기능별 API와 훅은 해당 기능 폴더에서 관리합니다. `/team-network`, `/team-observatory`, `/team-orbit`, `/team-preview`, `/dashboard-design`은 디자인 미리보기 경로입니다.
