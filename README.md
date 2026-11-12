<div align="center">

<a href="https://about.devlink.ai.kr/">
  <img src="src/assets/image/logo/logo-text.webp" alt="Visit the DevLink introduction page" width="480">
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

[Quick start](#quick-start) · [Usage examples](#usage-examples) · [Architecture](#architecture) · [Configuration](#configuration) · [Development](#development) · [Documentation](#documentation) · [License](#license)

</div>

## Introduction

DevLink is a collaboration tool that transfers task requests and development context between the AI coding tools used by team members.

Even when a frontend developer uses Codex and a backend developer uses Claude Code, they can request work from each other's Agent in their own development environment and follow questions, answers, progress, and results within the same task.

This repository maintains the **web workspace and Windows desktop app**. The web interface manages teams and Agents and displays team-wide tasks and conversations. The desktop app connects local projects and manages MCP configuration for AI tools and task notifications.

Authentication, task storage, and delivery APIs are maintained in the [server](https://github.com/SSAFY-URAYAHA/DevLink_server) repository. The local broker, CLI, and MCP server are maintained in the [client](https://github.com/SSAFY-URAYAHA/DevLink_client) repository. The user's AI tool performs code analysis, changes, and tests.

## Features

- **Accounts and teams** — Sign up, log in, create teams, join by invitation code, and view team members.
- **Agent management** — Register, edit, and delete team Agents, issue connection tokens, and check online status.
- **Team tasks and conversations** — View recent tasks across the team, task details, questions, answers, status changes, and completion results.
- **Real-time updates** — Receive task changes and Agent presence updates through SSE and track read status per task.
- **Change impact analysis** — Explore connections and change paths using repository dependency graphs and current working files.
- **Desktop project connections** — Choose a local project and AI tool, then apply MCP settings for supported versions or follow manual setup instructions.
- **Desktop task notifications** — Check the local broker for new tasks, questions, answers, and task results, and open the relevant conversation from a notification.

## Usage examples

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

## Quick start

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

Open [http://localhost:5173](http://localhost:5173) in your browser. With the backend running, the login screen appears and you can sign up, create a team, or join one.

If login or team requests fail, check the backend and the connection address in `.env.local` as well as the frontend terminal. This interface uses the actual server API.

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

## Configuration

| Environment variable | Purpose | Local default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend origin called by the browser | Empty |
| `DEVLINK_API_PROXY_TARGET` | Backend address used by the Vite development proxy | `http://localhost:8080` |

### Local API connection

When `VITE_API_BASE_URL` is empty, Vite forwards browser requests under `/api` to the backend. This proxy allows local development with session cookies without adding the frontend address to backend CORS settings.

If the backend uses another port, change `DEVLINK_API_PROXY_TARGET` and restart the development server. The development proxy removes the Origin header when forwarding requests; backend session and CSRF checks remain in place.

### Production deployment

In deployment environments, set `VITE_API_BASE_URL` to the actual HTTPS backend origin.

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

This is an example address. Replace it with the actual origin and **do not append `/api` or `/api/v1`**. The shared API client adds the path.

- `VITE_` variables are included in the build output and are public. Do not put passwords or Agent tokens in them.
- Rebuild and redeploy after changing these values.
- `DEVLINK_API_PROXY_TARGET` is for the development server only. It does not apply to `npm run preview` or static deployments.
- The backend must allow the frontend origin in CORS, permit credentialed requests, and configure production session cookies. If the sites differ, also check the browser's third-party cookie policy.

Use the following Vercel settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_BASE_URL` |

The root [vercel.json](vercel.json) provides SPA rewrites for direct access and refreshes on paths such as `/tree`. It does not provide a backend API proxy.

### Authentication and connection tokens

Web API requests include session cookies through `withCredentials` and fetch a CSRF token before state-changing requests. On reload, the app restores login state through the current-user API.

Passwords, session identifiers, and Agent tokens are not kept in browser storage. Issued Agent tokens can be viewed and copied on the current screen. Reissuing a token may affect existing connections, so review the notice first. UI preferences and task read states may be stored in the browser.

Web logout and Agent disconnection are separate. To check two accounts, use another browser or a private window to keep sessions separate.

## Development

### Main commands

Run these commands from the repository root.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript checks and create a production bundle |
| `npm run preview` | Preview the generated bundle |
| `npm run lint` | Run ESLint |

There is no separate root `npm test` script. See the [desktop development guide](desktop/README.md) for desktop execution, packaging, and verification commands.

### Code structure

```text
src/
├── app/                    # Entry points, routing, and shared providers
├── pages/                  # Auth, workspace, and dependency screens
├── features/
│   ├── auth/               # Accounts and sessions
│   ├── teams/              # Teams, members, and invitation codes
│   ├── agents/             # Agent management and token issuance
│   ├── tasks/              # Task lists, conversations, and real-time updates
│   ├── dependency-tree/    # Repository dependencies and change impact
│   ├── desktop-setup/      # Project and MCP connections, notifications
│   ├── workspace/          # Workspace composition
│   └── team-preview/       # 3D team screens and design previews
├── components/             # Shared UI
└── lib/                    # Shared API client and Query Client

desktop/                    # Electron app and Windows installer configuration
```

Reuse the shared Axios instance and Query Client, and keep feature-specific APIs and hooks in the relevant feature folder. `/team-network`, `/team-observatory`, `/team-orbit`, `/team-preview`, and `/dashboard-design` are design preview routes.

## Documentation

- [DevLink introduction](https://about.devlink.ai.kr/)
- [Desktop development, project connections, and MCP configuration](desktop/README.md)
- [3D team space design review notes](docs/team-space-design-notes.md)
- [Server setup and API guide](https://github.com/SSAFY-URAYAHA/DevLink_server#readme)
- [Client, CLI, and MCP guide](https://github.com/SSAFY-URAYAHA/DevLink_client#readme)
- [Windows installers and releases](https://github.com/SSAFY-URAYAHA/DevLink_frontend/releases)
- [Contributing guide](CONTRIBUTING.md)
- [Community code of conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)

## License

This project is licensed under the [MIT License](LICENSE.txt). See the license file for the full terms and copyright notice.
