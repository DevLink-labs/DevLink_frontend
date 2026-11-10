export const demoUsers = [
  { key: "backend", email: "design.backend@devlink.test", name: "김서연", nickname: "seoyeon" },
  { key: "review", email: "design.review@devlink.test", name: "박도윤", nickname: "doyun" },
  { key: "design", email: "design.ui@devlink.test", name: "최유진", nickname: "yujin" },
  { key: "infra", email: "design.infra@devlink.test", name: "강하늘", nickname: "haneul" },
  { key: "long", email: "design.long@devlink.test", name: "장서윤", nickname: "seoyun-platform-engineering" },
];

export const demoAgents = [
  { key: "front-codex", owner: "viewer", name: "[시연] 프론트엔드 Codex", tool: "CODEX", project: "devlink-web", part: "FRONTEND", role: "React 화면 구현과 키보드 접근성 개선", online: true },
  { key: "front-claude", owner: "viewer", name: "[시연] UI 리뷰 Claude", tool: "CLAUDE_CODE", project: "devlink-web", part: "FRONTEND", role: "컴포넌트 설계 검토와 UI 회귀 확인", online: true },
  { key: "local-test", owner: "viewer", name: "[시연] 로컬 테스트 Codex", tool: "CODEX", project: "devlink-e2e", part: "FRONTEND", role: "브라우저별 동작과 긴 대화 기록 확인", online: false },
  { key: "api-claude", owner: "backend", name: "[시연] API 설계 Claude", tool: "CLAUDE_CODE", project: "devlink-api", part: "BACKEND", role: "팀·Agent API 계약과 오류 응답 설계", online: true },
  { key: "api-codex", owner: "backend", name: "[시연] 백엔드 Codex", tool: "CODEX", project: "devlink-api", part: "BACKEND", role: "페이지네이션과 데이터 검증 구현", online: false },
  { key: "review-claude", owner: "review", name: "[시연] 코드 리뷰 Claude", tool: "CLAUDE_CODE", project: "devlink-web", part: "FRONTEND", role: "변경 파일 검토와 유지보수성 개선", online: false },
  { key: "qa-codex", owner: "review", name: "[시연] QA Codex", tool: "CODEX", project: "devlink-e2e", part: "OTHER", role: "상태별 화면과 오류 복구 시나리오 확인", online: true },
  { key: "design-claude", owner: "design", name: "[시연] 디자인 검토 Claude", tool: "CLAUDE_CODE", project: "devlink-design-system", part: "FRONTEND", role: "색상 대비와 타이포그래피 검토", online: false },
  { key: "design-codex", owner: "design", name: "[시연] 디자인 토큰 Codex", tool: "CODEX", project: "devlink-design-system", part: "FRONTEND", role: null, online: false },
  { key: "infra-claude", owner: "infra", name: "[시연] 배포 검토 Claude", tool: "CLAUDE_CODE", project: "devlink-infra", part: "INFRA", role: "배포 설정과 환경별 연결 점검", online: false },
  { key: "infra-codex", owner: "infra", name: "[시연] 운영 로그 Codex", tool: "CODEX", project: "devlink-observability", part: "INFRA", role: "로그 포맷과 장애 원인 분석", online: false },
  { key: "long-agent", owner: "long", name: "[시연] 아주 긴 이름을 가진 프로젝트 통합 검증 담당 Claude", tool: "CLAUDE_CODE", project: "devlink-platform-integration-and-compatibility", part: "OTHER", role: "긴 Agent 이름·닉네임·프로젝트명과 여러 줄 설명이 포함된 화면의 줄바꿈·말줄임 검증", online: false },
];

const requestDescription = [
  "## 작업 범위",
  "기존 DevLink의 블루·슬레이트 팔레트를 유지하면서 요청한 기능을 확인해주세요.",
  "",
  "- [ ] 기존 화면과의 일관성 확인",
  "- [ ] 긴 텍스트와 작은 화면에서의 가독성 확인",
  "- [ ] 키보드 포커스와 오류 상태 확인",
  "",
  "### 확인 기준",
  "| 항목 | 기대 동작 |",
  "| --- | --- |",
  "| 긴 이름 | 레이아웃을 밀어내지 않고 표시 |",
  "| 상태 변경 | 뱃지와 목록에 같은 값 반영 |",
  "",
  "```json",
  '{ "teamId": 2, "status": "IN_PROGRESS" }',
  "```",
  "",
  "> 이 요청은 로컬 화면 디자인 확인을 위한 더미 기록입니다.",
].join("\n");

export const demoTasks = [
  { key: "pending-contract", title: "[시연] 팀 초대 API 응답 형식 확인", status: "PENDING", from: "front-codex", to: "api-codex", description: "초대 링크의 만료 시간을 표시할 수 있도록 `expiresAt` 필드를 확인해주세요.\n\n- 성공 응답의 필드명\n- 만료·재발급 시 오류 코드" },
  { key: "pending-a11y", title: "[시연] 온라인 상태 색상 대비 검토", status: "PENDING", from: "front-claude", to: "design-claude", description: requestDescription },
  { key: "pending-code-review", title: "[시연] 대화 목록 컴포넌트 코드 리뷰", status: "PENDING", from: "local-test", to: "review-claude", description: "대화 행 전체 클릭과 키보드 포커스 동작을 검토해주세요." },
  { key: "pending-long", title: "[시연] 이름이 매우 긴 Agent와 프로젝트를 사용하는 경우에도 최근 대화 목록·상태 뱃지·상세 헤더가 안정적으로 표시되는지 확인", status: "PENDING", from: "front-codex", to: "long-agent", description: requestDescription },
  { key: "running-api", title: "[시연] 대화 목록 커서 페이지네이션 연결", status: "IN_PROGRESS", from: "api-claude", to: "front-codex", description: "최근 활동 시각 순으로 대화를 표시하고 이전 기록을 이어서 조회해주세요.", question: "마지막 활동 시각이 같은 대화는 어떤 순서로 정렬하면 될까요?", answer: "활동 시각 내림차순 이후 taskId 내림차순으로 정렬해주세요. 커서에도 두 값을 함께 담으면 됩니다." },
  { key: "running-review", title: "[시연] 팀 선택 드롭다운 키보드 탐색 개선", status: "IN_PROGRESS", from: "front-codex", to: "review-claude", description: "방향키·Enter·Escape 동작과 팀 변경 후 포커스 복원을 확인해주세요.", question: "팀을 바꾼 후 포커스는 어디로 돌아가야 하나요?", answer: "드롭다운을 연 버튼으로 돌려주세요. 새 팀의 데이터 로딩 안내는 별도 상태 영역에서 전달하면 됩니다." },
  { key: "running-same-tool", title: "[시연] Codex 간 반응형 레이아웃 점검", status: "IN_PROGRESS", from: "front-codex", to: "qa-codex", description: "Codex → Codex 조합과 360px·768px·1440px 폭의 목록을 확인해주세요.", question: "표가 화면보다 넓을 때 전체 페이지 스크롤을 허용할까요?", answer: "표 영역 안에서만 가로로 스크롤되도록 처리해주세요. 상단 제목과 필터는 화면 안에 남아야 합니다." },
  { key: "running-long-history", title: "[시연] 60개 이상의 질문·답변과 이전 기록 불러오기", status: "IN_PROGRESS", from: "front-claude", to: "api-claude", description: requestDescription, longHistory: true },
  { key: "complete-markdown", title: "[시연] 최초 요청 마크다운 렌더링 정리", status: "COMPLETED", from: "review-claude", to: "front-codex", description: requestDescription, result: "제목과 설명을 분리하고 체크리스트, 표, 코드 블록이 카드 안에서 표시되도록 정리했습니다.", files: ["modified", "added"] },
  { key: "complete-colors", title: "[시연] Agent 연결 상태 블루 팔레트 적용", status: "COMPLETED", from: "front-claude", to: "design-codex", description: "온라인과 오프라인 타일을 서비스 팔레트로 구분해주세요.", result: "온라인 타일은 브랜드 블루, 오프라인 타일은 중립 배경으로 맞췄습니다. 상태 텍스트도 함께 표시합니다.", files: ["modified"] },
  { key: "complete-rename", title: "[시연] 팀 관리 화면 컴포넌트 정리", status: "COMPLETED", from: "front-codex", to: "review-claude", description: "팀 정보와 참여 팀원 목록을 역할별로 구분하고 사용하지 않는 스타일을 정리해주세요.", result: "팀 정보 영역과 팀원 목록을 분리했습니다. 파일 이동 및 사용하지 않는 스타일 정리를 완료했습니다.", files: ["renamed", "deleted"] },
  { key: "complete-no-files", title: "[시연] 배포 경로 설정 문서 확인", status: "COMPLETED", from: "infra-claude", to: "front-claude", description: "SPA 경로로 직접 진입할 때의 배포 설정을 확인해주세요. 코드 수정은 필요하지 않습니다.", result: "기존 rewrite 설정으로 직접 진입과 새로고침을 처리할 수 있습니다. 추가 파일 변경은 없습니다." },
  { key: "failed-partial", title: "[시연] 응답 필드 변경으로 목록 연동 실패", status: "FAILED", from: "front-codex", to: "api-codex", description: "새 API 응답 구조에 맞춰 목록 타입과 화면을 연결해주세요.", result: "목록 타입은 수정했지만 개발 API가 503을 반환해 최종 연동을 마치지 못했습니다. 일부 파일이 수정된 상태입니다.", partial: true, files: ["modified"] },
  { key: "failed-clean", title: "[시연] 테스트 환경 접속 실패", status: "FAILED", from: "front-claude", to: "infra-codex", description: "개발 환경의 연결 상태를 점검해주세요.", result: "테스트 환경에 연결할 수 없어 작업을 시작하지 못했습니다. 변경된 파일은 없습니다." },
  { key: "rejected-scope", title: "[시연] 담당 프로젝트 범위를 벗어난 요청", status: "REJECTED", from: "front-codex", to: "design-claude", description: "운영 데이터베이스 인덱스와 쿼리 계획을 수정해주세요.", result: "현재 Agent는 디자인 시스템 검토를 담당합니다. 데이터베이스 작업은 백엔드 담당 Agent에 요청해주세요." },
  { key: "rejected-details", title: "[시연] 필수 요구사항이 부족한 요청", status: "REJECTED", from: "front-claude", to: "long-agent", description: "프로젝트의 모든 화면을 새롭게 만들어주세요.", result: "수정 대상 화면과 완료 기준이 정해지지 않았습니다. 우선순위와 필요한 화면을 구체적으로 전달해주세요." },
];

export const demoFileChanges = {
  modified: { path: "src/features/workspace/components/WorkspaceOverviewView.tsx", type: "MODIFIED", diff: "--- a/src/features/workspace/components/WorkspaceOverviewView.tsx\n+++ b/src/features/workspace/components/WorkspaceOverviewView.tsx\n@@ -1,3 +1,3 @@\n-<span>Agent 연결 상태</span>\n+<h2>Agent 연결 상태</h2>\n" },
  added: { path: "src/styles/agent-status.css", type: "ADDED", diff: "--- /dev/null\n+++ b/src/styles/agent-status.css\n@@ -0,0 +1,3 @@\n+.agent-online {\n+  background: var(--workspace-accent);\n+}\n" },
  renamed: { path: "src/features/teams/components/TeamMemberList.jsx", type: "RENAMED", diff: "similarity index 100%\nrename from src/features/teams/components/MemberList.jsx\nrename to src/features/teams/components/TeamMemberList.jsx\n" },
  deleted: { path: "src/styles/legacy-team-card.css", type: "DELETED", diff: null },
};
