<div align="center">

<a href="https://about.devlink.ai.kr/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../docs/images/devlink-logo-dark.png">
    <img src="../docs/images/devlink-logo.png" alt="Visit the DevLink introduction page" width="480">
  </picture>
</a>

# DevLink Desktop

**Connect local projects and follow your team's AI collaboration in one place.**

A Windows desktop app for setting up DevLink connections in Codex and Claude Code and following task conversations and notifications.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE.txt)
![Windows](https://img.shields.io/badge/Windows-x64-0078D4)
![Electron](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Bundled_Node.js-24-339933?logo=nodedotjs&logoColor=white)

**English** · [한국어](README.ko.md)

[Quick Start](#quick-start) · [Usage](#usage) · [Architecture](#architecture) · [Documentation](#documentation) · [Report a Bug](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues)

</div>

## About

DevLink connects your team's AI coding tools to share work requests and development context. From Codex and Claude Code, teammates can request work from each other's Agents and review progress and results.

This directory provides the **Electron-based Windows desktop app** that connects the web workspace to the local CLI. Choose a project folder and AI tool to prepare an Agent connection, then follow team task conversations and updates. Visit the [introduction page](https://about.devlink.ai.kr/) for the full service overview and demo.

## Features

- **Project and AI tool connections** — Choose a project folder and Codex or Claude Code, then enter a discipline and role tags to prepare an Agent connection.
- **MCP configuration guidance** — Apply project MCP settings for supported tool versions, or review instructions for editing the configuration manually.
- **Connection management** — List local connections for the current account and team, inspect configuration and AI tool connection status, and resume connections.
- **Team task views** — Use the web workspace to follow recent tasks, details, questions, answers, status changes, and completion results.
- **Task notifications** — Check the local broker for new tasks, questions, answers, and task results, and open the relevant conversation from a notification.
- **Project and tool profiles** — Connect the same project to Codex and Claude Code separately, keeping connection information scoped by account, team, project, and tool.

## Quick Start

### 1. Prerequisites

- A **Windows x64 PC** with an internet connection
- An installed **Codex or Claude Code**
- A **DevLink service account and team membership** — if needed, sign up in the app and create or join a team.
- A **local project folder** to open in your AI coding tool

The installer includes the DevLink CLI, MCP server, and Node.js 24. See the [desktop development guide](docs/development.ko.md#개발-환경) for tools needed to develop from source and build installers.

### 2. Install the desktop app

Download and run the Windows installer, `DevLink-Setup-<version>.exe`, from [GitHub Releases](https://github.com/SSAFY-URAYAHA/DevLink_frontend/releases). Launch DevLink from its shortcut after installation. The installed application executable is named `DevLinkDesktop.exe`.

The packaged app uses the web interface at `https://devlink.ai.kr` and the central server at `wss://api.devlink.ai.kr/`. To develop against a local server, follow the [development environment setup](docs/development.ko.md#개발-환경).

### 3. Connect your project

1. After logging in, prepare your team and project connection through **DevLink 시작하기 (Get started)**. Existing users can select **Agent → Agent 추가 (Add Agent)**.
2. Select the project's root folder.
3. Review the AI tool, discipline, and role tags, then click **연결하기 (Connect)**. If both Codex and Claude Code are detected, select the tool to use.
4. If CLI authentication is needed for the current account, enter your password, then review and apply the MCP configuration changes.

Configuration support depends on the bundled CLI and AI tool versions. If manual instructions appear, follow them while preserving other MCP servers and project settings in existing files.

### 4. Check the connection

Reopen Codex or Claude Code in that project to load the changed MCP settings. Ask your AI coding tool:

```text
Check DevLink's connection status and my Agent information.
If the connection is healthy, bind this MCP session to the current Agent
and show the team's Agents.
```

Also inspect the configuration and AI tool status under **연결 관리 (Connection management)** in the app. **Configuration readiness and an actual AI tool session connection are separate states.** Check that the displayed account, team, and Agent match your intended connection.

For troubleshooting, see [manual setup and connection checks](docs/development.ko.md#직접-설정과-설정-다시-보기).

## Usage

### Follow team tasks and results

Exchange work through DevLink MCP in your respective AI tools, then select the task from the app's recent task list. Review the request, questions, answers, progress, and completion results in one conversation.

The recipient's AI tool performs code analysis, changes, and tests. The app displays team work and results and manages local connections.

### Inspect or resume an existing connection

Open **연결 관리 (Connection management)** from the Agent list to view connections for the current account and team. **설정 확인 (Check configuration)** and **AI 도구 연결 확인 (Check AI tool connection)** are read-only. **연결 재개 (Resume connection)** runs setup again for the existing Agent.

Connecting the same project to Codex and Claude Code uses separate Agents and profiles. Connecting two Agents for the same tool in one project folder is not supported. If an existing Agent's token is not available on this PC, the app may ask for consent to reissue it; reissuing can affect connections on other PCs.

### Open conversations from task notifications

The app checks for updates every five seconds for each local profile connected to the logged-in user's teams. When the window is in the foreground, it shows in-app notifications; otherwise, it also shows Windows notifications. Clicking a notification opens the task conversation.

Checking notifications does not accept work or replace read and ACK handling by the AI tool. Notifications stop when the app exits and resume from the saved position when it starts again. A profile's first check skips historical events.

After an update, reopen your AI tool to use the new runtime. See the [installer guide](docs/development.ko.md#windows-설치-파일) for how installation, updates, and removal handle profiles and running connections.

## Architecture

| Component | Responsibility |
| --- | --- |
| Electron app | Web interface hosting, window management, and local integration |
| Web workspace | Login, team and Agent management, task conversations, and UI updates |
| Preload and IPC | Passing requests from the allowed web interface to local connection features |
| DevLink CLI, broker, and MCP | Project configuration, central server connections, and AI tool MCP requests |
| Notification service | Reading local updates and displaying in-app and Windows notifications |
| DevLink central server | User, team, Agent, and task storage, with REST APIs, WebSockets, and SSE |

The packaged app loads the deployed web interface; the development app loads Vite at `http://localhost:5173`. The CLI, MCP server, and Node runtime run from installation resources. Account-scoped connection profiles are managed under `.devlink/desktop/` in the user's home directory.

Local features are exposed only to the allowed top-level web frame, and the Electron main process also checks IPC caller origins. Opening the same web interface in a browser does not run the local CLI.

### Related repositories

| Repository | Responsibility |
| --- | --- |
| **DevLink_frontend — this repository** | Web workspace and this desktop app |
| [DevLink_client](https://github.com/SSAFY-URAYAHA/DevLink_client) | Bundled CLI, local broker, and MCP server |
| [DevLink_server](https://github.com/SSAFY-URAYAHA/DevLink_server) | Authentication, user/team/Agent/task management, and APIs |

## Documentation

| Guide | Covers |
| --- | --- |
| [Desktop development, packaging, and verification](docs/development.ko.md) | Local execution, profiles, manual setup, notifications, Windows installers, and verification procedures (Korean) |
| [Development environment example](.env.example) | CLI, MCP, Node, and test profile paths |
| [Desktop package configuration](package.json) | Execution, test, and packaging scripts and installer settings |
| [Frontend overview](../README.md) | Web workspace setup and features |
| [Frontend configuration and deployment](../docs/frontend-guide.md) | API proxy, authentication, and web deployment |
| [Client project setup](https://github.com/SSAFY-URAYAHA/DevLink_client/blob/master/rust/docs/setup.md) | CLI and AI tool configuration and profiles |
| [Client desktop update contract](https://github.com/SSAFY-URAYAHA/DevLink_client/blob/master/rust/docs/desktop-updates.md) | The update query contract used by the desktop app |

The development guide documents source execution, packaging, and verification commands. After code or documentation changes, verify the relevant installed-app and AI tool behavior as well as the local UI, and record the results in the PR.

## Contributing

Bug reports, documentation improvements, and feature proposals are welcome. Open an [Issue](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues) with the app version, operating system, AI tool and CLI versions, reproduction steps, expected behavior, and actual behavior. Remove passwords, tokens, and personal information from logs and screenshots.

See the [contributing guide](../CONTRIBUTING.md) for development and PR conventions, and the [security policy](../SECURITY.md) for vulnerability reporting.

## License

DevLink Desktop is distributed under the repository's [MIT License](../LICENSE.txt).
