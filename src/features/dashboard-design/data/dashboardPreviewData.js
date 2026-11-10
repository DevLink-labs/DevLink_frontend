export const previewTeam = {
  name: "DevLink 제품팀",
  project: "DevLink",
  description: "개발자와 Agent가 함께 만드는 협업 공간",
  members: [
    { id: 1, name: "이정민", nickname: "jungmin", role: "소유자", specialty: "Frontend", initials: "JM" },
    { id: 2, name: "김서연", nickname: "seoyeon", role: "팀원", specialty: "Backend", initials: "SY" },
    { id: 3, name: "박도윤", nickname: "doyun", role: "팀원", specialty: "Frontend", initials: "DY" },
    { id: 4, name: "최유진", nickname: "yujin", role: "팀원", specialty: "Design", initials: "YJ" },
  ],
};

export const previewAgents = [
  { id: "frontend-codex", name: "Frontend Codex", tool: "CODEX", owner: "이정민", project: "devlink-web", status: "ONLINE" },
  { id: "api-claude", name: "API Claude", tool: "CLAUDE_CODE", owner: "김서연", project: "devlink-api", status: "ONLINE" },
  { id: "review-claude", name: "Review Claude", tool: "CLAUDE_CODE", owner: "박도윤", project: "devlink-web", status: "ONLINE" },
  { id: "design-codex", name: "Design Codex", tool: "CODEX", owner: "최유진", project: "design-system", status: "ONLINE" },
  { id: "test-codex", name: "Test Codex", tool: "CODEX", owner: "박도윤", project: "devlink-web", status: "OFFLINE" },
  { id: "infra-claude", name: "Infra Claude", tool: "CLAUDE_CODE", owner: "김서연", project: "devlink-infra", status: "OFFLINE" },
];

export const previewTasks = [
  {
    id: 128,
    title: "팀 초대 API 응답 형식 확인",
    description: "팀원 초대 화면에 연결할 API의 응답 필드와 초대 만료 시간을 확인해주세요.",
    requesterId: "frontend-codex",
    receiverId: "api-claude",
    status: "PENDING",
    time: "방금",
    createdAt: "2026-11-10T01:50:00.000Z",
    messages: [
      { sender: "requester", text: "초대 링크 생성 후 만료 시간을 함께 표시하려고 합니다. 응답에 expiresAt 필드가 포함되는지 확인해주세요.", time: "10:50" },
    ],
  },
  {
    id: 127,
    title: "Agent 상태 뱃지 접근성 검토",
    description: "온라인과 오프라인 상태의 명도 대비, 스크린리더 안내 문구를 검토해주세요.",
    requesterId: "frontend-codex",
    receiverId: "design-codex",
    status: "PENDING",
    time: "5분 전",
    createdAt: "2026-11-10T01:45:00.000Z",
    messages: [
      { sender: "requester", text: "상태를 배경색과 텍스트로 구분했습니다. 작은 화면에서도 상태를 쉽게 읽을 수 있는지 검토해주세요.", time: "10:45" },
    ],
  },
  {
    id: 126,
    title: "대화 목록 페이지네이션 연동",
    description: "대화가 많아져도 빠르게 확인할 수 있도록 커서 기반 목록 조회를 연결합니다.",
    requesterId: "frontend-codex",
    receiverId: "api-claude",
    status: "IN_PROGRESS",
    time: "12분 전",
    createdAt: "2026-11-10T01:15:00.000Z",
    messages: [
      { sender: "requester", text: "목록 조회 API에 다음 페이지 커서와 hasNext 필드를 추가할 수 있을까요?", time: "10:15" },
      { sender: "receiver", text: "요청을 수락했습니다. 최근 활동 시각 기준으로 정렬하고 다음 페이지 커서를 반환하도록 수정하고 있습니다.", time: "10:38" },
    ],
  },
  {
    id: 125,
    title: "팀 선택 드롭다운 키보드 탐색",
    description: "방향키로 팀을 선택하고 Escape 키로 닫을 수 있도록 동작을 점검합니다.",
    requesterId: "design-codex",
    receiverId: "review-claude",
    status: "IN_PROGRESS",
    time: "24분 전",
    createdAt: "2026-11-10T01:05:00.000Z",
    messages: [
      { sender: "requester", text: "팀 변경 후에도 포커스가 유지되는지 확인해주세요. 방향키와 Enter 키로 선택할 수 있어야 합니다.", time: "10:05" },
      { sender: "receiver", text: "드롭다운을 닫은 뒤 트리거로 포커스를 돌리는 부분을 확인하고 있습니다.", time: "10:26" },
    ],
  },
  {
    id: 124,
    title: "요청 메시지 마크다운 렌더링 개선",
    description: "최초 요청의 제목과 설명을 분리하고 코드 블록과 목록의 간격을 정리했습니다.",
    requesterId: "review-claude",
    receiverId: "frontend-codex",
    status: "COMPLETED",
    time: "48분 전",
    createdAt: "2026-11-10T00:25:00.000Z",
    messages: [
      { sender: "requester", text: "구조화된 요청의 title과 description을 분리하고 description의 마크다운을 렌더링해주세요.", time: "09:25" },
      { sender: "receiver", text: "제목과 본문을 분리했습니다. 코드 블록, 링크, 목록도 대화 영역 안에서 읽기 쉽게 표시됩니다.", time: "10:02" },
    ],
  },
  {
    id: 123,
    title: "Agent 연결 해제 상태 동기화",
    description: "연결이 종료된 Agent의 상태가 팀 현황과 대시보드에 동일하게 표시되도록 수정했습니다.",
    requesterId: "api-claude",
    receiverId: "frontend-codex",
    status: "COMPLETED",
    time: "1시간 전",
    createdAt: "2026-11-09T23:40:00.000Z",
    messages: [
      { sender: "requester", text: "연결 해제 이벤트를 받았을 때 Agent 목록의 상태를 갱신해주세요.", time: "08:40" },
      { sender: "receiver", text: "목록과 요약 현황이 같은 연결 상태를 사용하도록 반영했습니다.", time: "09:50" },
    ],
  },
];
