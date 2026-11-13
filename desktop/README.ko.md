<div align="center">

<a href="https://about.devlink.ai.kr/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../docs/images/devlink-logo-dark.png">
    <img src="../docs/images/devlink-logo.png" alt="DevLink 소개 페이지로 이동" width="480">
  </picture>
</a>

# DevLink Desktop

**로컬 프로젝트를 연결하고, 팀의 AI 협업을 한곳에서 확인하세요.**

Codex·Claude Code의 DevLink 연결을 준비하고 작업 대화와 알림을 확인하는 Windows 데스크톱 앱입니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE.txt)
![Windows](https://img.shields.io/badge/Windows-x64-0078D4)
![Electron](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Bundled_Node.js-24-339933?logo=nodedotjs&logoColor=white)

[English](README.md) · **한국어**

[빠른 시작](#빠른-시작) · [사용 예시](#사용-예시) · [동작 구조](#동작-구조) · [문서](#문서) · [버그 제보](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues)

</div>

## 소개

DevLink는 팀원들의 AI 코딩 도구 사이에서 작업 요청과 개발 맥락을 전달하는 협업 도구입니다. Codex와 Claude Code에서 상대 Agent에게 작업을 요청하고 진행 상황과 결과를 확인할 수 있습니다.

이 디렉터리는 웹 워크스페이스와 로컬 CLI를 연결하는 **Electron 기반 Windows 데스크톱 앱**을 제공합니다. 프로젝트 폴더와 AI 도구를 선택해 Agent 연결을 준비하고, 팀의 작업 대화와 새 소식을 확인합니다. 전체 서비스 소개와 데모는 [소개 페이지](https://about.devlink.ai.kr/)에서 확인할 수 있습니다.

## 주요 기능

- **프로젝트·AI 도구 연결** — 프로젝트 폴더와 Codex·Claude Code를 선택하고, 담당 파트·역할 태그를 입력해 Agent 연결을 준비합니다.
- **MCP 설정 안내** — 지원하는 도구 버전에서는 프로젝트 MCP 설정을 적용하고, 직접 설정할 때는 파일에 반영할 내용을 안내합니다.
- **연결 관리** — 현재 계정·팀의 로컬 연결을 조회하고, 설정 확인·AI 도구 연결 확인·연결 재개를 제공합니다.
- **팀 작업 조회** — 팀의 최근 작업, 상세 정보와 질문·답변·상태 변경·완료 결과를 웹 워크스페이스에서 확인합니다.
- **작업 알림** — 로컬 브로커에서 새 작업·질문·답변과 작업 결과를 확인하고, 알림에서 해당 대화로 이동합니다.
- **프로젝트·도구별 프로필** — 같은 프로젝트를 Codex와 Claude Code에 각각 연결하고, 계정·팀·프로젝트·도구별 연결 정보를 구분합니다.

## 빠른 시작

### 1. 준비하기

- **Windows x64 PC**와 인터넷 연결
- 설치된 **Codex 또는 Claude Code**
- DevLink 서비스의 **사용자 계정과 가입된 팀** — 계정과 팀이 없다면 앱에서 회원가입 후 생성·참여합니다.
- AI 코딩 도구에서 열 **로컬 프로젝트 폴더**

설치본에는 DevLink CLI·MCP 서버와 Node.js 24가 포함됩니다. 소스 개발과 설치 파일 제작에 필요한 도구는 [데스크톱 개발 안내](docs/development.ko.md#개발-환경)를 참고하세요.

### 2. 데스크톱 앱 설치

[GitHub Releases](https://github.com/SSAFY-URAYAHA/DevLink_frontend/releases)에서 Windows 설치 파일 `DevLink-Setup-<버전>.exe`를 내려받아 실행합니다. 설치 후 바로가기에서 DevLink를 실행하세요. 설치된 앱의 실행 파일명은 `DevLinkDesktop.exe`입니다.

설치본은 `https://devlink.ai.kr`의 웹 화면과 `wss://api.devlink.ai.kr/`의 중앙 서버를 사용합니다. 로컬 서버를 대상으로 개발하려면 [개발 환경 설정](docs/development.ko.md#개발-환경)을 따릅니다.

### 3. 프로젝트 연결

1. 로그인 후 **DevLink 시작하기**에서 팀 준비와 프로젝트 연결을 진행합니다. 기존 사용자는 **Agent → Agent 추가**를 선택합니다.
2. 프로젝트의 루트 폴더를 선택합니다.
3. 사용할 AI 도구와 담당 파트·역할 태그를 확인하고 **연결하기**를 누릅니다. Codex와 Claude Code가 모두 감지되면 사용할 도구를 선택합니다.
4. 현재 계정의 CLI 인증이 필요하면 비밀번호를 입력하고, MCP 설정 변경 내용을 확인해 적용합니다.

설정 지원 범위는 동봉된 CLI와 AI 도구 버전에 따라 달라집니다. 직접 설정 안내가 나오면 표시된 내용에 따라 기존 파일의 다른 MCP·프로젝트 설정을 유지하며 적용합니다.

### 4. 연결 확인

해당 프로젝트에서 Codex 또는 Claude Code를 다시 열어 변경한 MCP 설정을 불러옵니다. AI 코딩 도구에 다음과 같이 요청합니다.

```text
DevLink의 연결 상태와 내 Agent 정보를 확인해줘.
연결에 문제가 없으면 현재 Agent로 MCP 세션을 연결하고 팀 Agent 목록을 보여줘.
```

앱의 **연결 관리**에서 설정과 AI 도구 연결 상태도 확인하세요. **설정 준비 완료와 실제 AI 도구 세션 연결은 별개**입니다. 표시된 계정·팀·Agent가 의도한 연결과 일치하는지 확인합니다.

문제가 있으면 [직접 설정과 연결 확인](docs/development.ko.md#직접-설정과-설정-다시-보기)을 참고하세요.

## 사용 예시

### 팀 작업과 결과 확인

각자의 AI 도구에서 DevLink MCP로 작업을 주고받은 뒤, 앱의 최근 작업 목록에서 해당 작업을 선택합니다. 요청 내용, 질문·답변, 진행 상태와 완료 결과를 같은 대화에서 확인할 수 있습니다.

코드 분석·수정·테스트는 상대방이 사용하는 AI 도구가 수행합니다. 앱은 팀의 작업과 결과를 조회하고 로컬 연결을 관리합니다.

### 기존 연결을 확인하거나 재개

Agent 목록의 **연결 관리**에서 현재 계정·팀의 연결을 확인합니다. **설정 확인**과 **AI 도구 연결 확인**은 조회만 수행하고, **연결 재개**를 눌렀을 때 기존 Agent로 연결 절차를 다시 실행합니다.

같은 프로젝트를 Codex와 Claude Code에 각각 연결하면 서로 다른 Agent와 프로필을 사용합니다. 같은 도구의 Agent 두 개를 한 프로젝트 폴더에 연결하는 방식은 지원하지 않습니다. 기존 Agent의 토큰이 이 PC에 없으면 재발급 동의를 요청할 수 있으며, 재발급은 다른 PC의 연결에 영향을 줄 수 있습니다.

### 새 작업 알림에서 대화로 이동

앱은 로그인한 사용자의 팀에 연결된 로컬 프로필마다 5초 간격으로 새 소식을 확인합니다. 창을 보고 있으면 앱 안 알림을 표시하고, 그렇지 않으면 Windows 알림도 표시합니다. 알림을 누르면 해당 작업 대화로 이동합니다.

알림 조회는 작업을 수락하거나 AI 도구의 읽음·ACK 처리를 대신하지 않습니다. 앱을 종료하면 알림도 멈추고, 다시 실행하면 저장한 조회 위치부터 이어서 확인합니다. 프로필을 처음 조회할 때는 과거 이력을 알리지 않습니다.

업데이트 후에는 AI 도구를 다시 열어 새 런타임을 사용하세요. 설치·업데이트·제거 시 프로필과 실행 중 연결을 다루는 방식은 [설치 파일 안내](docs/development.ko.md#windows-설치-파일)를 참고하세요.

## 동작 구조

| 구성 요소 | 역할 |
| --- | --- |
| Electron 앱 | 웹 화면 표시, 창 관리와 로컬 기능 연결 |
| 웹 워크스페이스 | 로그인, 팀·Agent 관리, 작업·대화 조회와 화면 갱신 |
| Preload·IPC | 허용된 웹 화면의 요청을 로컬 연결 기능으로 전달 |
| DevLink CLI·브로커·MCP | 프로젝트 설정, 중앙 서버 연결과 AI 도구의 MCP 요청 처리 |
| 알림 처리기 | 로컬 업데이트를 조회하고 앱·Windows 알림 표시 |
| DevLink 중앙 서버 | 사용자·팀·Agent·작업 데이터 저장과 REST·WebSocket·SSE 제공 |

설치본은 배포된 웹 화면을, 개발 앱은 `http://localhost:5173`의 Vite 화면을 불러옵니다. CLI·MCP·Node 런타임은 설치 리소스에서 실행하며, 계정별 연결 프로필은 사용자 홈의 `.devlink/desktop/` 아래에 관리합니다.

로컬 기능은 허용된 최상위 웹 프레임에만 제공하고, Electron main 프로세스에서도 IPC 호출 출처를 확인합니다. 브라우저에서 같은 웹 화면을 여는 것만으로 로컬 CLI가 실행되지는 않습니다.

### 관련 저장소

| 저장소 | 역할 |
| --- | --- |
| **DevLink_frontend — 현재 저장소** | 웹 워크스페이스와 이 데스크톱 앱 |
| [DevLink_client](https://github.com/SSAFY-URAYAHA/DevLink_client) | 동봉하는 CLI, 로컬 브로커와 MCP 서버 |
| [DevLink_server](https://github.com/SSAFY-URAYAHA/DevLink_server) | 인증, 사용자·팀·Agent·작업 관리와 API |

## 문서

| 문서 | 내용 |
| --- | --- |
| [데스크톱 개발·패키징·검증](docs/development.ko.md) | 로컬 실행, 프로필, 직접 설정, 알림, Windows 설치 파일과 검증 절차 |
| [개발 환경 변수 예시](.env.example) | CLI·MCP·Node·테스트 프로필 경로 |
| [데스크톱 패키지 설정](package.json) | 실행·테스트·패키징 명령과 설치 파일 설정 |
| [프론트엔드 안내](../README.ko.md) | 웹 워크스페이스 설치와 기능 소개 |
| [프론트엔드 설정과 배포](../docs/frontend-guide.ko.md) | API 프록시, 인증과 웹 배포 |
| [Client 프로젝트 설정](https://github.com/SSAFY-URAYAHA/DevLink_client/blob/master/rust/docs/setup.md) | CLI·AI 도구 설정과 프로필 |
| [Client 데스크톱 알림 계약](https://github.com/SSAFY-URAYAHA/DevLink_client/blob/master/rust/docs/desktop-updates.md) | 데스크톱에서 사용하는 업데이트 조회 계약 |

소스 실행, 패키징과 검증 명령은 개발 문서에서 안내합니다. 코드·문서 변경 후에는 로컬 UI뿐 아니라 필요한 설치본·AI 도구 동작도 검증하고 결과를 PR에 기록합니다.

## 기여하기

버그 제보, 문서 개선과 기능 제안을 환영합니다. [Issues](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues)에 앱 버전, 운영체제, AI 도구·CLI 버전, 재현 방법과 기대한 동작·실제 동작을 남겨주세요. 로그와 화면 자료에서는 비밀번호·토큰·개인정보를 제거합니다.

개발 참여와 PR 규칙은 [기여 가이드](../CONTRIBUTING.ko.md), 보안 취약점 제보는 [보안 정책](../SECURITY.ko.md)을 참고하세요.

## 라이선스

DevLink Desktop은 저장소의 [MIT 라이선스](../LICENSE.txt)로 배포됩니다.
