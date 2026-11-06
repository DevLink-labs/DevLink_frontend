export interface DesktopStatus {
  exitCode: number;
  result: {
    data?: { userId?: string; teamId?: string; connection: { setupReady: boolean } };
  };
}

export interface SetupAccount {
  userId: number;
  teamId: number;
  email: string;
}

export type SetupTool = "codex" | "claude-code";

export interface ProjectSelection {
  id: string;
  name: string;
  tools: SetupTool[];
}

interface SetupProgress {
  step: string;
  status: string;
}

export type SetupResult =
  | { state: "password"; message?: string }
  | { state: "manual"; targetPath: string; snippet: string }
  | { state: "done" }
  | { state: "error"; message: string; code?: string };

export interface DesktopSetupApi {
  pickFolder: (account: SetupAccount) => Promise<ProjectSelection | null>;
  run: (id: string, tool: SetupTool, password?: string) => Promise<SetupResult>;
  check: (id: string) => Promise<boolean>;
  openConfigFolder: (id: string) => Promise<void>;
  onProgress: (listener: (event: SetupProgress) => void) => () => void;
}

interface DesktopApi {
  version: string;
  getStatus?: () => Promise<DesktopStatus>;
  setup?: DesktopSetupApi;
}

declare global {
  interface Window {
    devlinkDesktop?: DesktopApi;
  }
}

export function getDesktopApi(): DesktopApi | null {
  return typeof window === "undefined" ? null : (window.devlinkDesktop ?? null);
}
