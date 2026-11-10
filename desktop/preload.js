const { contextBridge, ipcRenderer } = require("electron");

function appArgument(name) {
  const prefix = `--devlink-${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

const origin = appArgument("origin");
if (process.isMainFrame && window.location.origin === origin) {
  contextBridge.exposeInMainWorld("devlinkDesktop", {
    version: appArgument("version"),
    ...(["http://localhost:5173", "https://devlink.ai.kr"].includes(origin) && {
      getStatus: (account) => ipcRenderer.invoke("devlink:status", account),
      capabilities: { manualMcpSetup: 1 },
      updates: {
        watch: (account) => ipcRenderer.invoke("devlink:watchUpdates", account),
        stop: () => ipcRenderer.invoke("devlink:stopUpdates"),
        onUpdates: (listener) => {
          const handler = (_event, items) => listener(items);
          ipcRenderer.on("devlink:updates", handler);
          return () => ipcRenderer.removeListener("devlink:updates", handler);
        },
        onOpenTask: (listener) => {
          const handler = (_event, target) => listener(target);
          ipcRenderer.on("devlink:open-task", handler);
          return () => ipcRenderer.removeListener("devlink:open-task", handler);
        },
      },
      setup: {
        pickFolder: (account) =>
          ipcRenderer.invoke("devlink:pickFolder", account),
        run: (id, tool, password, metadata, options) =>
          ipcRenderer.invoke(
            "devlink:setup",
            id,
            tool,
            password,
            metadata,
            options,
          ),
        resetContext: () => ipcRenderer.invoke("devlink:resetSetupContext"),
        listConnections: (account) =>
          ipcRenderer.invoke("devlink:listConnections", account),
        getGuide: (id) => ipcRenderer.invoke("devlink:getGuide", id),
        inspect: (id) => ipcRenderer.invoke("devlink:inspectSetup", id),
        resume: (id, password) =>
          ipcRenderer.invoke("devlink:resumeSetup", id, password),
        check: (id) => ipcRenderer.invoke("devlink:checkSetup", id),
        openConfigFolder: (id) =>
          ipcRenderer.invoke("devlink:openConfigFolder", id),
        onProgress: (listener) => {
          const handler = (_event, progress) => listener(progress);
          ipcRenderer.on("devlink:setup-event", handler);
          return () =>
            ipcRenderer.removeListener("devlink:setup-event", handler);
        },
      },
    }),
  });
}
