import type { SetupResult } from "../api/desktopApi";

// CLI 영문 안내 대신 다음 행동을 알려주는 오류 문구
const messages: Record<string, string> = {
  SETUP_AGENT_REJECTED:
    "이 폴더에 연결된 Agent를 서버에서 찾을 수 없습니다. 웹에서 Agent를 삭제했다면 Agent 목록의 ‘Agent 추가’에서 같은 폴더를 다시 연결해 새 Agent를 만들어주세요. 앱이 최신 버전이 아니면 다른 폴더를 선택해주세요.",
};

export function localizeSetupError(result: SetupResult): SetupResult {
  return result.state === "error" && result.code && messages[result.code]
    ? { ...result, message: messages[result.code] }
    : result;
}
