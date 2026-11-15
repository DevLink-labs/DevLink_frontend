import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import DependencySourceForm from "./DependencySourceForm";
import DependencyTreeFrame from "./DependencyTreeFrame";
import DependencyFlowView from "./DependencyFlowView";
import { useDependencyTree } from "../hooks/useDependencyTree";
import sample from "../data/dependencyTreeFixture.json";

const title = "DevLink 변경 영향 범위";

function SampleTree({ modeAction }) {
  const { t } = useTranslation();
  const [frame, setFrame] = useState(1);
  const controls = <label>{t("시연 상황")}
    <select value={frame} onChange={(event) => setFrame(Number(event.target.value))}>
      {sample.activityFrames.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
    </select>
  </label>;
  return <DependencyFlowView graph={sample.graph} activity={sample.activityFrames[frame].data}
    frame={{ title: t(title), description: t("프론트엔드 화면에서 백엔드 API와 데이터베이스까지 이어지는 변경 경로를 확인하세요."), modeAction, controls }} />;
}

function TeamTree({ userId, team, teamsPending, teamsError, modeAction }) {
  const { t } = useTranslation();
  const { repositories, graph, activity, register } = useDependencyTree(userId, team?.teamId ?? null);
  const error = teamsError ?? repositories.error ?? graph.error;
  const accessDenied = [error, activity.error].some((failure) => [401, 403, 404].includes(failure?.status));
  const frame = {
    title: t(title),
    description: t("팀 저장소의 연결 관계와 현재 변경 중인 파일을 확인하세요."),
    modeAction,
    panel: <>
      {error && <p role="alert">{error.message}</p>}
      {activity.isError && <p role="status">{accessDenied ? activity.error.message : t("작업 상태를 갱신하지 못했습니다.")}</p>}
      {team?.myRole === "OWNER" && !accessDenied && <DependencySourceForm key={team.teamId} userId={userId} teamId={team.teamId}
        repositories={repositories.data ?? []} register={register} />}
    </>,
  };
  if (team && graph.data && !accessDenied) return <DependencyFlowView key={team.teamId} graph={graph.data} activity={activity.data} frame={frame} />;
  return <DependencyTreeFrame {...frame}>
    <div className="dependency-empty">
      {teamsPending && <p role="status">{t("팀 목록을 읽고 있습니다.")}</p>}
      {!teamsPending && !teamsError && !team && <p>{t("등록된 팀이 없습니다.")}</p>}
      {team && graph.isPending && !error && <p role="status">{t("팀 그래프를 읽고 있습니다.")}</p>}
      {accessDenied && <p>{t("이 팀의 트리를 볼 권한이 없습니다.")}</p>}
    </div>
  </DependencyTreeFrame>;
}

/** @param {{ userId: number, team: import("@/features/teams/types").Team | null, teamsPending: boolean, teamsError: Error | null }} props */
export default function DependencyMapView({ userId, team, teamsPending, teamsError }) {
  const { t } = useTranslation();
  const [showSample, setShowSample] = useState(false);
  const modeAction = (
    <button className="dependency-mode-action" type="button" onClick={() => setShowSample((current) => !current)}>
      {showSample ? t("내 팀 트리 보기") : t("예제 보기")}
    </button>
  );

  return showSample
    ? <SampleTree modeAction={modeAction} />
    : <TeamTree userId={userId} team={team} teamsPending={teamsPending} teamsError={teamsError} modeAction={modeAction} />;
}
