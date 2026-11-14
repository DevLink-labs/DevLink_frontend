import TaskConversationView from "@/features/tasks/components/TaskConversationView";
import { demoActors, demoTask, demoTaskStatus, demoTeam } from "../data/demoScenario";

const requesterAgent = { agentId: 1, name: demoActors.requester.name };
const receiverAgent = { agentId: 2, name: demoActors.receiver.name };
const recordedEvents = [
  {
    eventId: "101",
    sequence: "1",
    eventType: "CREATED",
    authorAgent: null,
    message: null,
    questionEventId: null,
    createdAt: "2026-11-12T14:00:00",
  },
  {
    eventId: "102",
    sequence: "2",
    eventType: "STATUS_CHANGED",
    authorAgent: null,
    message: "PENDING → IN_PROGRESS: 작업 수락",
    questionEventId: null,
    createdAt: "2026-11-12T14:01:00",
  },
  {
    eventId: "103",
    sequence: "3",
    eventType: "QUESTION",
    authorAgent: receiverAgent,
    message: demoTask.question,
    questionEventId: null,
    createdAt: "2026-11-12T05:02:00Z",
  },
  {
    eventId: "104",
    sequence: "4",
    eventType: "ANSWER",
    authorAgent: requesterAgent,
    message: demoTask.answer,
    questionEventId: "103",
    createdAt: "2026-11-12T05:03:00Z",
  },
  {
    eventId: "105",
    sequence: "5",
    eventType: "STATUS_CHANGED",
    authorAgent: null,
    message: "IN_PROGRESS → COMPLETED: 작업 완료",
    questionEventId: null,
    createdAt: "2026-11-12T14:06:00",
  },
];

const taskPrompt = JSON.stringify({ title: demoTask.title, description: demoTask.request });
const resultText = `${demoTask.result}\n\n${demoTask.checks.map((check) => `• ${check}`).join("\n")}`;

export default function DemoTaskConversation({ stepId, progress, capture = false, onBack, onAccept }) {
  const status = demoTaskStatus(stepId, progress);
  const completed = status === "COMPLETED";
  const resultStep = stepId === "result";
  const eventCount = resultStep ? (completed ? 5 : 4) : stepId === "conversation" ? progress + 1 : 1;
  const items = recordedEvents.slice(0, eventCount);
  const latestEvent = items.at(-1);
  const detail = {
    taskId: demoTask.id,
    teamId: 1,
    teamName: demoTeam,
    taskSummary: demoTask.title,
    requesterAgent,
    receiverAgent,
    status,
    createdAt: recordedEvents[0].createdAt,
    startedAt: status === "PENDING" ? null : recordedEvents[1].createdAt,
    completedAt: completed ? latestEvent.createdAt : null,
    lastActivityAt: latestEvent.createdAt,
  };
  const history = {
    taskId: detail.taskId,
    prompt: taskPrompt,
    resultText: completed ? resultText : null,
    failureReason: null,
    rejectionReason: null,
    partiallyModified: false,
    taskFiles: [],
    items,
    nextBeforeSequence: null,
    hasNext: false,
  };

  return (
    <TaskConversationView
      onBack={onBack}
      preview={{
        detail,
        history,
        enteringEventId: progress > 0 ? latestEvent.eventId : undefined,
        followLatest: resultStep || eventCount > 1,
        capture,
        onAccept,
      }}
    />
  );
}
