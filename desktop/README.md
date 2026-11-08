# DevLink 데스크톱 개발

Windows에서 Node.js 24와 로컬 DevLink 서버를 준비합니다. CLI와 MCP 서버는 `DevLink_client`에서 빌드한 결과물을 사용합니다.

도구 감지와 계정 전환 시 MCP 설정 갱신에는 `devlink setup tools` 및 `mcp.mode=replace`를 지원하는 최신 CLI가 필요합니다. 기존 바이너리를 사용 중이라면 `DevLink_client/rust`에서 `cargo build --release -p devlink-cli`로 다시 빌드합니다.

프론트 저장소 루트에서 Vite를 실행합니다. `61907`은 로컬 서버 포트에 맞춰 바꿉니다.

```powershell
npm ci
$env:VITE_API_BASE_URL = ''
$env:DEVLINK_API_PROXY_TARGET = 'http://127.0.0.1:61907'
npm run dev -- --host localhost --port 5173 --strictPort
```

별도 PowerShell에서 `desktop`으로 이동해 `.env.local`을 설정하고 Electron을 실행합니다.

```powershell
cd desktop
npm ci
Copy-Item .env.example .env.local
```

`.env.local`의 `DEVLINK_DESKTOP_CONFIG_PATH`를 로컬 서버를 가리키는 테스트 프로필의 `config.json`으로 바꿉니다. 프로필이 없다면 사용자 홈 아래의 전용 폴더에 다음과 같이 만듭니다.

```powershell
$cli = (Resolve-Path '../../DevLink_client/rust/target/release/devlink.exe').Path
$testDir = Join-Path $env:USERPROFILE 'devlink-test'
New-Item -ItemType Directory -Force $testDir | Out-Null
$testConfig = Join-Path $testDir 'config.json'
# 새 테스트 프로필에서만 실행합니다.
if (Test-Path $testConfig) { throw '이미 존재하는 테스트 프로필입니다.' }
& $cli --config $testConfig init
if ($LASTEXITCODE -ne 0) { throw '테스트 프로필 초기화 실패' }
& $cli --config $testConfig config set serverUrl 'ws://127.0.0.1:61907/'
```

```powershell
npm run dev
```

창 아이콘은 `public/devlink.svg`를 Windows용으로 변환한 `desktop/assets/devlink.ico`를 사용합니다. 아이콘 설정 변경 후에는 프론트 새로고침 대신 Electron 앱을 종료하고 다시 실행합니다. Windows 실행 파일 패키징에도 같은 아이콘을 사용합니다.

Electron이 최초 실행 시 Windows 런타임을 내려받습니다. 로그인 후 팀 대시보드의 **Agent → 이 PC 연결**에서 프로젝트의 루트 폴더를 선택합니다. Codex와 Claude Code 중 하나만 감지되면 자동으로 사용하고, 둘 다 감지되면 선택할 수 있습니다. 해당 계정의 CLI 세션이 없거나 다른 계정으로 인증돼 있으면 현재 계정의 비밀번호를 입력합니다.

`DEVLINK_DESKTOP_CONFIG_PATH`는 기준 프로필입니다. CLI 프로필 하나는 Agent 하나(서버·사용자·팀·프로젝트)에 묶이므로, 앱은 프로젝트마다 기준 프로필 폴더 아래 `accounts/<서버 해시>/<사용자 ID>/teams/<팀 ID>/<프로젝트 해시>/config.json`을 자동으로 사용합니다. 기준 프로필이나 이전 계정별 프로필(`accounts/<서버 해시>/<사용자 ID>/config.json`)의 Agent가 같은 서버·사용자·팀·프로젝트에 속하면 해당 프로필을 재사용하고, 기준 프로필에 Agent가 없으면 같은 계정의 로그인 세션이 있을 때 기준 프로필을 사용합니다. 프로젝트 연결과 수동 설정 확인은 선택한 프로젝트의 프로필을 사용하고, 대시보드의 연결 상태는 현재 팀에 연결된 프로필 중 하나라도 준비되면 연결됨으로 표시합니다. 새 프로필은 로그인 정보와 Agent 토큰을 복사하지 않으므로 처음 연결하는 프로젝트마다 비밀번호를 확인하며, 로컬 브로커 포트를 자동 할당합니다. 같은 프로젝트에서 처음 연결한 것과 다른 AI 도구를 선택하면 기존 CLI 바인딩 정책에 따라 연결하지 않습니다.

설정 이력과 본인 소유 Agent가 없는 계정은 로그인 후 **DevLink 시작하기**에서 팀 준비와 프로젝트 연결을 순서대로 진행합니다. 완료하거나 **나중에 설정**을 선택한 이력은 현재 브라우저·앱에 계정별로 저장합니다. 기존 Agent가 있는 계정은 대시보드로 바로 진입하며, 추가 연결은 **Agent → 이 PC 연결**에서 진행합니다.

Windows 권한 검사를 통과하려면 사용자 전용 폴더에 프로젝트를 준비합니다. 바탕화면 아래의 MCP 경로가 권한 검사에서 거부되면 사용자 전용 폴더에 MCP의 `dist`, `package.json`, `node_modules`를 복사하고 `.env.local`의 `DEVLINK_DESKTOP_MCP_ENTRY`를 복사한 `dist/index.js`로 바꿉니다.

기존 브로커가 테스트 프로필의 포트를 사용 중이면 `devlink --config <테스트 config> config set localPort <빈 포트>`로 테스트 프로필에 다른 포트를 지정합니다.

프로젝트를 연결하면 지원 버전의 Codex·Claude Code 설정에서 DevLink 항목을 선택한 계정의 프로필로 갱신합니다. 기존 파일은 CLI가 비공개 백업으로 보존하고, 다른 MCP 서버와 프로젝트 설정은 유지합니다. 적용 직전 파일이 변경되면 덮어쓰지 않고 중단합니다. 같은 프로젝트에서 계정을 바꾼 뒤에는 AI 도구를 다시 열어 변경된 연결 정보를 사용합니다. 미검증 도구 버전은 기존과 같이 수동 설정 안내를 표시합니다.

계정별 프로필 및 데스크톱 IPC 회귀 테스트는 저장소 루트에서 `node --test desktop/tests/setup-profiles.test.cjs`로 실행합니다.
