import type { Group, Object3D } from "three";
import type { AgentSessionConnection } from "./agentSessionConnections.js";

export interface AgentSessionAnchor {
  object: Object3D;
  memberId: string;
}

export function createAgentSessionLinks(): {
  group: Group;
  update: (
    connections: AgentSessionConnection[],
    anchors: Map<string, AgentSessionAnchor>,
    time: number,
    reveal: number,
    focusedMemberId: string | null,
  ) => void;
  dispose: () => void;
};
