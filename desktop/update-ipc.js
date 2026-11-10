const { app, ipcMain, Notification } = require("electron");
const path = require("node:path");
const { listTeamProfiles, readSavedBinding } = require("./setup-profiles");
const { loadDevelopmentPaths, runUpdates } = require("./setup-runner");
const { createUpdateNotifier } = require("./update-notifier");

// 한 번에 많이 도착하면 PC 알림은 요약 한 건만 표시
const MAX_POPUPS = 3;

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateAccount(account) {
  if (
    !validId(account?.userId) ||
    typeof account?.email !== "string" ||
    !/^[^\s@]+@[^\s@]+$/.test(account.email) ||
    account.email.length > 255 ||
    !Array.isArray(account.teamIds) ||
    account.teamIds.length > 100 ||
    !account.teamIds.every(validId)
  ) {
    throw new Error("현재 로그인 계정과 팀을 확인해주세요.");
  }
  return {
    userId: account.userId,
    email: account.email,
    teamIds: [...new Set(account.teamIds)],
  };
}

function registerUpdateHandlers(
  window,
  webOrigin,
  loadPaths = loadDevelopmentPaths,
) {
  // 클릭 처리 전 GC로 사라지지 않도록 표시 중인 알림 보관
  const popups = new Set();

  function send(channel, payload) {
    if (
      !window.isDestroyed() &&
      URL.parse(window.webContents.getURL())?.origin === webOrigin
    ) {
      window.webContents.send(channel, payload);
    }
  }

  function open(item) {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    // 작업이 없는 안내는 창만 표시
    if (item?.taskId) {
      send("devlink:open-task", {
        teamId: Number(item.teamId),
        taskId: Number(item.taskId),
      });
    }
  }

  function popup(title, body, item) {
    const notification = new Notification({ title, body });
    popups.add(notification);
    const release = () => popups.delete(notification);
    notification.on("click", () => {
      release();
      open(item);
    });
    notification.on("close", release);
    notification.show();
  }

  function show(items) {
    send("devlink:updates", items);
    // 앱을 보고 있으면 앱 안 알림만 표시
    if (
      window.isDestroyed() ||
      window.isFocused() ||
      !Notification.isSupported()
    )
      return;
    // 폴더 누락 같은 안내는 요약하지 않고 각각 표시
    const tasks = items.filter((item) => item.taskId);
    for (const item of items)
      if (!item.taskId) popup(item.title, item.body, item);
    if (tasks.length > MAX_POPUPS) {
      popup(
        "DevLink 새 소식",
        `작업·질문·답변 소식 ${tasks.length}건이 도착했습니다.`,
      );
      return;
    }
    for (const item of tasks) popup(item.title, item.body, item);
  }

  const notifier = createUpdateNotifier({
    loadPaths,
    listProfiles: listTeamProfiles,
    runUpdates,
    projectOf: async (paths, account) =>
      (await readSavedBinding(paths, account))?.projectPath,
    statePath: path.join(app.getPath("userData"), "update-cursors.json"),
    show,
  });

  function handle(name, action) {
    ipcMain.handle(`devlink:${name}`, (event, ...args) => {
      const frame = event.senderFrame;
      if (
        event.sender !== window.webContents ||
        !frame ||
        frame.parent ||
        frame.origin !== webOrigin
      ) {
        throw new Error("허용되지 않은 데스크톱 요청입니다.");
      }
      return action(...args);
    });
  }

  handle("watchUpdates", (account) => notifier.watch(validateAccount(account)));
  handle("stopUpdates", () => notifier.stop());
  window.on("closed", () => notifier.stop());
}

module.exports = { registerUpdateHandlers };
