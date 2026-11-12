export interface DesktopStatus {
  exitCode: number;
  hasSavedConnections?: boolean;
  result: {
    data?: {
      userId?: string;
      teamId?: string;
      connection: { setupReady: boolean };
    };
  };
}

export interface SetupAccount {
  userId: number;
  teamId: number;
  email: string;
}

export type SetupTool = "codex" | "claude-code";

export interface SetupAgentMetadata {
  part?: "FRONTEND" | "BACKEND" | "INFRA" | "OTHER";
  roles?: string[];
}

export interface ProjectSelection {
  id: string;
  name: string;
  tools: SetupTool[];
  saved?: boolean;
  authRequired?: boolean;
}

export interface SavedConnection {
  id: string;
  name: string;
  projectPath: string;
  tool: SetupTool;
  agentId: string;
  fileState: McpGuide["fileState"];
  availability: McpGuide["availability"] | "auth_required";
}

export interface McpGuide {
  userId: string;
  teamId: string;
  agentId: string;
  projectPath: string;
  toolType: "codex" | "claude_code";
  automaticSupported: boolean;
  targetPath: string;
  observedAt: string;
  availability: "ready" | "needs_preparation";
  fileState:
    | "file_missing"
    | "entry_missing"
    | "matches"
    | "different"
    | "invalid"
    | "unavailable";
  editKind:
    | "create_file"
    | "add_container"
    | "add_entry"
    | "replace_entry"
    | "none"
    | "fix_file";
  copyItems: {
    scope: "whole_file" | "container" | "entry";
    syntax: "toml" | "json";
    title: string;
    snippet: string;
  }[];
  reason: string;
  nextActions: string[];
}

export interface SetupInspection {
  guide: McpGuide;
  connection: {
    observedAt: string;
    broker: string;
    central: string;
    identity: string;
    credentials: string;
    mcpConfig: string;
    hostSession: "bound" | "unbound" | "conflict" | "not_checked" | "unknown";
    setupReady: boolean;
    collaborationReady: boolean | null;
  } | null;
}

interface SetupProgress {
  step: string;
  status: string;
}

export type SetupResult =
  | { state: "password"; message?: string }
  | { state: "token"; agentId: string }
  | { state: "manual"; targetPath: string; snippet: string }
  | { state: "done" }
  | { state: "error"; message: string; code?: string };

export interface DesktopSetupApi {
  pickFolder: (account: SetupAccount) => Promise<ProjectSelection | null>;
  run: (
    id: string,
    tool: SetupTool,
    password?: string,
    metadata?: SetupAgentMetadata,
    options?: { mcpMode: "automatic" | "manual" },
  ) => Promise<SetupResult>;
  resetContext?: () => Promise<void>;
  listConnections?: (account: SetupAccount) => Promise<SavedConnection[]>;
  getGuide?: (id: string) => Promise<McpGuide>;
  inspect?: (id: string) => Promise<SetupInspection>;
  resume?: (id: string, password?: string) => Promise<SetupResult>;
  issueToken?: (id: string) => Promise<SetupResult>;
  check: (id: string) => Promise<boolean>;
  openConfigFolder: (id: string) => Promise<void>;
  onProgress: (listener: (event: SetupProgress) => void) => () => void;
}

export interface UpdatesAccount {
  userId: number;
  email: string;
  teamIds: number[];
}

export interface DesktopTaskUpdate {
  kind: string;
  teamId: string;
  // 연결 폴더 누락 같은 안내에는 없음
  taskId?: string;
  title: string;
  body: string;
}

export interface DesktopTaskTarget {
  teamId: number;
  taskId: number;
}

export interface DesktopUpdatesApi {
  watch: (account: UpdatesAccount) => Promise<void>;
  stop: () => Promise<void>;
  onUpdates: (listener: (items: DesktopTaskUpdate[]) => void) => () => void;
  onOpenTask: (listener: (target: DesktopTaskTarget) => void) => () => void;
}

interface DesktopApi {
  version: string;
  capabilities?: { manualMcpSetup?: number };
  getStatus?: (account: SetupAccount) => Promise<DesktopStatus>;
  setup?: DesktopSetupApi;
  updates?: DesktopUpdatesApi;
}

declare global {
  interface Window {
    devlinkDesktop?: DesktopApi;
  }
}

export function getDesktopApi(): DesktopApi | null {
  return typeof window === "undefined" ? null : (window.devlinkDesktop ?? null);
}
