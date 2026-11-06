# DevLink 데스크톱 개발

Windows에서 Node.js 24와 로컬 DevLink 서버를 준비합니다. CLI와 MCP 서버는 `DevLink_client`에서 빌드한 결과물을 사용합니다.

도구 감지에는 `devlink setup tools`를 지원하는 CLI가 필요합니다. 기존 바이너리를 사용 중이라면 `DevLink_client/rust`에서 `cargo build --release -p devlink-cli`로 다시 빌드합니다.

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

Electron이 최초 실행 시 Windows 런타임을 내려받습니다. 로그인 후 팀 대시보드의 **Agent → 이 PC 연결**에서 프로젝트의 루트 폴더를 선택합니다. Codex와 Claude Code 중 하나만 감지되면 자동으로 사용하고, 둘 다 감지되면 선택할 수 있습니다. CLI 세션이 없으면 같은 계정의 비밀번호를 입력합니다. 앱은 테스트 프로필 하나를 사용하므로 같은 계정·팀·프로젝트·도구로 재실행을 확인합니다.

Windows 권한 검사를 통과하려면 사용자 전용 폴더에 프로젝트를 준비합니다. 바탕화면 아래의 MCP 경로가 권한 검사에서 거부되면 사용자 전용 폴더에 MCP의 `dist`, `package.json`, `node_modules`를 복사하고 `.env.local`의 `DEVLINK_DESKTOP_MCP_ENTRY`를 복사한 `dist/index.js`로 바꿉니다.

기존 브로커가 테스트 프로필의 포트를 사용 중이면 `devlink --config <테스트 config> config set localPort <빈 포트>`로 테스트 프로필에 다른 포트를 지정합니다.
