import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const state = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "design-seed.local"), "utf8"));
const origin = new URL(state.origin);
if (!["127.0.0.1", "localhost"].includes(origin.hostname) || origin.port !== "8080") {
  throw new Error("로컬 시연 서버의 주소를 확인해주세요.");
}
const agents = Object.values(state.agents).filter((agent) => agent.online);
const sockets = new Set();
let stopping = false;
let counter = 0;

function connect(agent) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${origin.host}/ws/broker`, {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    sockets.add(socket);
    let ready = false;
    let lastPong = Date.now();
    let heartbeat;
    const timeout = setTimeout(() => {
      reject(new Error(`시연 Agent #${agent.id} 연결 시간 초과`));
      socket.close();
    }, 15_000);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "BROKER_READY") {
        if (message.payload.agent_id !== agent.id) {
          socket.close();
          reject(new Error("시연 Agent 연결 신원이 다릅니다."));
          return;
        }
        ready = true;
        clearTimeout(timeout);
        socket.send(JSON.stringify({ type: "AGENT_PRESENCE", payload: { status: "ONLINE" } }));
        heartbeat = setInterval(() => {
          if (Date.now() - lastPong > 40_000) {
            socket.close();
            return;
          }
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "HEARTBEAT", payload: { kind: "PING", ping_id: `design-demo-${++counter}` } }));
          }
        }, 12_000);
        resolve();
      } else if (message.type === "HEARTBEAT" && message.payload.kind === "PONG") {
        lastPong = Date.now();
      }
    });
    socket.addEventListener("error", () => {
      if (!ready) reject(new Error(`시연 Agent #${agent.id} 연결 실패`));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      sockets.delete(socket);
      if (!ready) reject(new Error(`시연 Agent #${agent.id} 연결 종료`));
      if (!stopping && ready) setTimeout(() => { void connect(agent).catch((error) => console.error(error.message)); }, 3_000);
    });
  });
}

function stop() {
  stopping = true;
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "AGENT_PRESENCE", payload: { status: "OFFLINE" } }));
      socket.close(1000, "Local design preview stopped");
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  await Promise.all(agents.map(connect));
  console.log(`로컬 더미 Agent ${agents.length}개의 온라인 연결을 유지하고 있습니다.`);
} catch (error) {
  console.error(error.message);
  stop();
}
