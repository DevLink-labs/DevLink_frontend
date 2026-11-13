<div align="center">

<a href="https://about.devlink.ai.kr/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/devlink-logo-dark.png">
    <img src="docs/images/devlink-logo.png" alt="Visit the DevLink introduction page" width="480">
  </picture>
</a>

# DevLink Frontend

**See your team's AI Agents and workflow at a glance.**

The DevLink web interface and desktop app bring together team and Agent connections, task conversations, and change impact analysis.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.txt)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)

**English** · [한국어](README.ko.md)

[Quick Start](#quick-start) · [Usage](#usage) · [Architecture](#architecture) · [Documentation](#documentation) · [Report a Bug](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues)

</div>

## About

DevLink connects your team's AI coding tools to share work requests and development context. From Codex and Claude Code, teammates can request work from each other's Agents and review progress and results.

This repository provides the **web workspace and Windows desktop app** for managing teams and Agents, following task conversations, and connecting local projects. The user's AI tool performs code analysis, changes, and tests. Visit the [introduction page](https://about.devlink.ai.kr/) for the full service overview and demo.

## Features

- **Accounts and teams** — Sign up, log in, create teams, join by invitation code, and view team members.
- **Agent management** — Register, edit, and delete team Agents, issue connection tokens, and check online status.
- **Team tasks and conversations** — View recent tasks across the team, task details, questions, answers, status changes, and completion results.
- **Real-time updates** — Receive task changes and Agent presence updates through SSE and track read status per task.
- **Change impact analysis** — Explore connections and change paths using repository dependency graphs and current working files.
- **Desktop project connections** — Choose a local project and AI tool, then apply MCP settings for supported versions or follow manual setup instructions.
- **Desktop task notifications** — Check the local broker for new tasks, questions, answers, and task results, and open the relevant conversation from a notification.

## Quick Start

### 1. Prerequisites

- **Git**
- **Node.js 24 recommended**, with npm — the Vite version in the lockfile supports Node.js `^20.19.0 || >=22.12.0`.
- A running **DevLink server** — the default connection address is `http://localhost:8080`.

```sh
node --version
npm --version
```

Running the frontend itself does not require Java, Rust, or Docker. To run the server locally as well, follow the [server quick start](https://github.com/SSAFY-URAYAHA/DevLink_server#quick-start) first. Connecting a local Agent requires separate client or desktop setup.

### 2. Get the source and dependencies

```sh
git clone https://github.com/SSAFY-URAYAHA/DevLink_frontend.git
cd DevLink_frontend
npm ci
```

Copy the environment example to `.env.local`. If the file already exists, review it and update only the values you need.

**Windows PowerShell**

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

**macOS / Linux**

```sh
[ -f .env.local ] || cp .env.example .env.local
```

The default local configuration is:

```dotenv
VITE_API_BASE_URL=
DEVLINK_API_PROXY_TARGET=http://localhost:8080
```

### 3. Start the development server

```sh
npm run dev -- --host localhost --port 5173 --strictPort
```

### 4. Check the interface

Open [http://localhost:5173](http://localhost:5173) in your browser. With the backend running, the login screen appears and you can sign up, create a team, or join one.

If login or team requests fail, check the backend and the connection address in `.env.local` as well as the frontend terminal. This interface uses the actual server API.

For API configuration, production deployment, and development commands, see the [frontend guide](docs/frontend-guide.md).

## Usage

### Follow team Agents and task progress

1. Sign up and log in on the web, then create a team or join using an invitation code.
2. Check registered team Agents and their connection status on the Agent screen.
3. Exchange tasks through DevLink MCP in your respective AI tools.
4. Select a task from the recent task list on the web to view its summary, status, and conversation history.

For example, when a frontend Agent asks a backend Agent to investigate a slow post-list API, team members can follow the questions, answers, and completion results on the web. The list displays **all team tasks**, including tasks you did not participate in.

Registering an Agent or issuing a token does not make it online by itself. The local broker and AI tool must be connected.

### Connect a local project on desktop

1. Download and run the Windows installer from [Releases](https://github.com/SSAFY-URAYAHA/DevLink_frontend/releases).
2. After logging in, start project connection from the onboarding guide or **Agent → Agent 추가 (Add Agent)**.
3. Select the project folder and AI tool, then follow the connection instructions.
4. After applying the settings, reopen the AI tool and check the actual Agent connection status.

MCP configuration readiness and the AI tool session connection are displayed separately. See the [desktop guide](desktop/README.md) for manual setup and reconnecting.

### Explore repository change impact

After logging in, open `/tree?mode=team` to view the team's actual repository dependency graph and work activity. A team OWNER can register the repository key, base branch, publishing Agent, and other settings. The broker must upload analysis data before the graph appears.

`/tree` displays a **sample graph** without requiring login. Keep it separate from actual team data.

## Architecture

| Component | Responsibility |
| --- | --- |
| Web UI | User login, team and Agent management, task and conversation views, dependency graphs |
| DevLink server | User sessions and permissions, data storage, REST APIs, and SSE |
| Electron app | Web UI hosting, local project connections, CLI calls, and task notifications |
| Local client | Connecting AI tools to the central server through the CLI, broker, and MCP server |
| AI tool | Task analysis, code changes, and tests in the user's project |

The web UI calls REST APIs using a cookie-based user session and receives change notifications through SSE. TanStack Query handles data fetching and caching, and a shared Axios client handles HTTP requests.

The browser-based web UI does not execute the local CLI directly. The desktop app provides local connection features through Electron IPC. The packaged app loads the web UI from `https://devlink.ai.kr`; the development app uses `http://localhost:5173`.

### Related repositories

| Repository | Responsibility |
| --- | --- |
| **DevLink_frontend — this repository** | Web workspace and Windows desktop app |
| [DevLink_server](https://github.com/SSAFY-URAYAHA/DevLink_server) | Authentication, user/team/Agent/task management, APIs, and data storage |
| [DevLink_client](https://github.com/SSAFY-URAYAHA/DevLink_client) | CLI, local broker, and MCP server |

## Documentation

| Guide | Covers |
| --- | --- |
| [Frontend configuration and deployment](docs/frontend-guide.md) | API connections, environment variables, authentication, deployment, and code structure |
| [Desktop development and connection setup](desktop/README.md) | Electron development, project connections, MCP configuration, notifications, and Windows packaging |
| [3D team space design review notes](docs/team-space-design-notes.md) | Design goals and review decisions |
| [Server setup and API guide](https://github.com/SSAFY-URAYAHA/DevLink_server#readme) | Running the backend and using its APIs |
| [Client, CLI, and MCP guide](https://github.com/SSAFY-URAYAHA/DevLink_client#readme) | Local broker and AI tool integration |
| [Windows installers and releases](https://github.com/SSAFY-URAYAHA/DevLink_frontend/releases) | Desktop installers and release notes |

See the [frontend development guide](docs/frontend-guide.md#development) for build and lint commands, the [desktop guide](desktop/README.md) for desktop verification, and the [contributing guide](CONTRIBUTING.md) for participation and PR conventions. The detailed desktop development guide and design notes are currently written in Korean.

## Contributing

Bug reports, documentation improvements, and feature proposals are welcome. Open an [Issue](https://github.com/SSAFY-URAYAHA/DevLink_frontend/issues) with your environment, reproduction steps, expected behavior, and actual behavior. Remove passwords and tokens from logs and screenshots.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and PR conventions, and [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

This project is licensed under the [MIT License](LICENSE.txt). See the license file for the full terms and copyright notice.
