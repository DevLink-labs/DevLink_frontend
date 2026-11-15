import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { useAgents } from "@/features/agents/hooks/useAgents";

export default function DependencySourceForm({ userId, teamId, repositories, register }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState("BACKEND");
  const agents = useAgents(userId, teamId);
  const backends = repositories.filter(({ repoKind }) => repoKind === "BACKEND");

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = form.get("targetRepoId");
    register.mutate({
      repoKey: form.get("repoKey").trim(),
      displayName: form.get("displayName").trim(),
      branchName: form.get("branchName").trim(),
      repoKind: kind,
      publisherAgentId: Number(form.get("publisherAgentId")),
      targetRepoId: target ? Number(target) : null,
      resetSnapshot: form.has("resetSnapshot"),
    });
  }

  return (
    <details className="dependency-source">
      <summary>{t("저장소 등록·설정")}</summary>
      <p>{t("프로젝트에서")}{" "}<code>devlink dependency-repo-key</code>{t("를 실행해 저장소 키를 확인하세요.")}</p>
      <form onSubmit={submit}>
        <label>{t("저장소 키")}{" "}<input name="repoKey" pattern="[0-9a-f]{64}" required /></label>
        <label>{t("표시명")}{" "}<input name="displayName" maxLength={120} required /></label>
        <label>{t("기준 브랜치")}{" "}<input name="branchName" placeholder="develop" maxLength={255} required /></label>
        <label>{t("저장소 종류")}<select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="BACKEND">BE</option><option value="FRONTEND">FE</option>
          </select>
        </label>
        <label>{t("발행 Agent")}<select name="publisherAgentId" defaultValue="" required>
            <option value="">{t("선택")}</option>
            {agents.data?.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agent.name} · #{agent.agentId}</option>)}
          </select>
        </label>
        {kind === "FRONTEND" && (
          <label>{t("연결할 BE 저장소")}<select name="targetRepoId" defaultValue="">
              <option value="">{t("선택")}</option>
              {backends.map((repo) => <option key={repo.repoId} value={repo.repoId}>{repo.displayName}</option>)}
            </select>
          </label>
        )}
        <label className="dependency-check"><input name="resetSnapshot" type="checkbox" />{" "}{t("기존 분석 초기화")}</label>
        <button type="submit" disabled={register.isPending}>{t("저장소 설정 저장")}</button>
      </form>
      {register.isError && <p role="alert">{register.error.message}</p>}
      {register.isSuccess && <p role="status">{t("설정을 저장했습니다. 브로커가 기준 브랜치를 분석하면 트리가 나타납니다.")}</p>}
    </details>
  );
}
