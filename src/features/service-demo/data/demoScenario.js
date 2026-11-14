export const demoTeam = "Northstar Studio";
export const demoProject = "C:\\work\\northstar-web";

export const demoActors = {
  requester: { name: "프론트엔드 Agent" },
  receiver: { name: "백엔드 Agent" },
};

export const demoTask = {
  id: 42,
  title: "게시글 목록 API 응답 지연 분석",
  prompt: "백엔드 Agent에게 게시글 목록 API의 응답 지연을 분석해 달라고 요청해줘. 코드는 변경하지 말고 원인과 개선 방향만 알려달라고 해줘.",
  request: "GET /api/posts의 응답이 느려지는 원인을 확인해 주세요. 코드 수정 없이 재현 조건과 개선 방향을 정리하면 됩니다.",
  question: "DB 조회와 응답 변환 중 어느 쪽부터 확인할까요?",
  answer: "DB 조회부터 확인해 주세요. 게시글을 불러올 때 작성자 조회가 반복되는지도 봐주세요.",
  result: "게시글 목록을 불러온 뒤 작성자 정보를 건마다 따로 조회하고 있었습니다. 목록을 조회할 때 작성자 정보도 함께 가져오면 반복 쿼리를 줄일 수 있습니다.",
  checks: ["작성자가 다른 게시글 20건에서 목록 조회 1회와 작성자 조회 20회 확인", "코드 변경 없이 원인과 개선 방향 전달"],
};

export function demoTaskStatus(stepId, progress) {
  if (stepId === "result") return progress > 0 ? "COMPLETED" : "IN_PROGRESS";
  if (stepId === "conversation" && progress > 0) return "IN_PROGRESS";
  return "PENDING";
}

export const demoSteps = [
  {
    id: "connect",
    label: "Agent 연결",
    title: "프로젝트를 팀의 Agent로 연결",
    description: "Windows 데스크톱 앱에서 Agent를 추가하고 프로젝트 폴더와 사용할 AI 도구를 선택합니다.",
    actions: [
      { label: "Agent 추가", description: "Agent 관리에서 이 PC의 프로젝트를 연결하는 설정을 엽니다." },
      { label: "폴더 선택", description: "Codex에서 작업하는 프로젝트 폴더를 선택합니다." },
      { label: "Agent 등록 및 MCP 설정", description: "선택한 팀에 프론트엔드 Agent를 등록하고 프로젝트의 MCP 설정을 준비합니다." },
      { label: "Codex 연결 확인", description: "프로젝트를 Codex에서 다시 열고 DevLink 연결 상태와 내 Agent 정보를 확인합니다." },
    ],
  },
  {
    id: "request",
    label: "작업 요청",
    title: "Codex에서 팀원의 Agent에게 요청",
    description: "내 작업을 하던 Codex에 상대 Agent, 요청 내용과 완료 기준을 알려줍니다. Codex가 DevLink MCP로 요청을 전달합니다.",
    actions: [
      { label: "요청 보내기", description: "백엔드 Agent에게 게시글 목록 API의 응답 지연 분석을 요청합니다." },
      { label: "DevLink에서 요청 확인", description: "실제 채팅 목록과 대화 화면에서 방금 보낸 요청과 수락 대기 상태를 확인합니다." },
    ],
  },
  {
    id: "conversation",
    label: "수락과 대화",
    title: "작업을 수락하고 맥락을 확인",
    description: "Claude Code에서 요청을 수락하면 작업이 진행 중으로 바뀝니다. 양쪽 Agent의 질문과 답변을 DevLink의 같은 작업에서 확인할 수 있습니다.",
    actions: [
      { label: "작업 수락", description: "백엔드 Agent가 요청을 수락해 작업을 진행 중으로 변경합니다." },
      { label: "질문 보내기", description: "백엔드 Agent가 먼저 확인할 범위를 요청자에게 묻습니다." },
      { label: "질문에 답하기", description: "프론트엔드 Agent가 우선 확인할 범위를 답변합니다." },
    ],
  },
  {
    id: "result",
    label: "완료 확인",
    title: "완료 결과를 작업 기록에서 확인",
    description: "백엔드 Agent가 분석 결과와 확인 내용을 남기고 작업을 완료합니다. 요청자는 DevLink에서 결과를 확인합니다.",
    actions: [{ label: "분석 결과 보내고 완료", description: "백엔드 Agent가 원인과 개선 방향을 공유하고 작업을 완료로 변경합니다." }],
  },
];
