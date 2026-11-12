# Frontend configuration and deployment

**English** · [한국어](frontend-guide.ko.md)

[Project overview](../README.md) · [Quick Start](../README.md#quick-start) · [Contributing guide](../CONTRIBUTING.md)

Start the web interface using the README quick start first. This guide covers API configuration, authentication, deployment, development commands, and code structure. Run commands from the repository root.

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

The root [vercel.json](../vercel.json) provides SPA rewrites for direct access and refreshes on paths such as `/tree`. It does not provide a backend API proxy.

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

There is no separate root `npm test` script. See the [desktop development guide](../desktop/README.md) for desktop execution, packaging, and verification commands.

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
