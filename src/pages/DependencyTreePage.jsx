import { useState } from "react";
import PageTitle from "@/components/common/PageTitle";
import { useTeams } from "@/features/teams/hooks/useTeams";
import DependencySourceForm from "@/features/dependency-tree/components/DependencySourceForm";
import DependencyTreeFrame from "@/features/dependency-tree/components/DependencyTreeFrame";
import DependencyTreeView from "@/features/dependency-tree/components/DependencyTreeView";
import { useDependencyTree } from "@/features/dependency-tree/hooks/useDependencyTree";
import sample from "@/features/dependency-tree/data/dependencyTreeFixture.json";

const title = "DevLink 변경 영향 범위";

function SampleTree({ links }) {
  const [frame, setFrame] = useState(1);
  const controls = <label>시연 상황
    <select value={frame} onChange={(event) => setFrame(Number(event.target.value))}>
      {sample.activityFrames.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
    </select>
  </label>;
  return <DependencyTreeView graph={sample.graph} activity={sample.activityFrames[frame].data}
    frame={{ title, description: "프론트엔드 화면에서 백엔드 API와 데이터베이스까지 이어지는 변경 경로를 확인하세요.", links, controls }} />;
}

function TeamTree({ user, links }) {
  const teams = useTeams(user.userId);
  const [selected, setSelected] = useState(null);
  const team = teams.data?.find(({ teamId }) => teamId === selected) ?? teams.data?.[0];
  const { repositories, graph, activity, register } = useDependencyTree(user.userId, team?.teamId ?? null);
  const error = teams.error ?? repositories.error ?? graph.error;
  const accessDenied = [error, activity.error].some((failure) => [401, 403, 404].includes(failure?.status));
  const frame = {
    title,
    description: "팀 저장소의 연결 관계와 현재 변경 중인 파일을 확인하세요.",
    links,
    controls: team && <label>팀 <select value={team.teamId} onChange={(event) => setSelected(Number(event.target.value))}>
      {teams.data.map((item) => <option key={item.teamId} value={item.teamId}>{item.name}</option>)}
    </select></label>,
    panel: <>
      {error && <p role="alert">{error.message}</p>}
      {activity.isError && <p role="status">{accessDenied ? activity.error.message : "작업 상태를 갱신하지 못했습니다."}</p>}
      {team?.myRole === "OWNER" && !accessDenied && <DependencySourceForm key={team.teamId} userId={user.userId} teamId={team.teamId}
        repositories={repositories.data ?? []} register={register} />}
    </>,
  };
  if (graph.data && !accessDenied) return <DependencyTreeView key={team.teamId} graph={graph.data} activity={activity.data} frame={frame} />;
  return <DependencyTreeFrame {...frame}>
    <div className="dependency-empty">
      {teams.isPending && <p role="status">팀 목록을 읽고 있습니다.</p>}
      {teams.isSuccess && !team && <p>등록된 팀이 없습니다.</p>}
      {team && graph.isPending && !error && <p role="status">팀 그래프를 읽고 있습니다.</p>}
      {accessDenied && <p>이 팀의 트리를 볼 권한이 없습니다.</p>}
    </div>
  </DependencyTreeFrame>;
}

/** @param {{ user?: import("../features/auth/types").User | null }} props */
export default function DependencyTreePage({ user = null }) {
  const links = <>
    <a href={user ? "/tree" : "/tree?mode=team"}>{user ? "샘플 보기" : "내 팀 보기"}</a>
    <a href="/">워크스페이스</a>
  </>;
  return <>
    <PageTitle title={title} />
    {user ? <TeamTree user={user} links={links} /> : <SampleTree links={links} />}
  </>;
}
