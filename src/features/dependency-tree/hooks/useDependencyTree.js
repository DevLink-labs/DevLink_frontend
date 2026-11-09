import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dependencyTreeApi } from "../api/dependencyTreeApi";

export function useDependencyTree(userId, teamId) {
  const queryClient = useQueryClient();
  const key = ["workspace", userId, "dependency-tree", teamId];
  const enabled = teamId !== null;
  const repositories = useQuery({
    queryKey: [...key, "repositories"],
    queryFn: ({ signal }) => dependencyTreeApi.list(teamId, signal),
    enabled,
    refetchInterval: 30_000,
  });
  const revision = repositories.data?.map(({ repoId, revision }) => [repoId, revision]);
  const graph = useQuery({
    queryKey: [...key, "graph", revision],
    queryFn: ({ signal }) => dependencyTreeApi.graph(teamId, signal),
    enabled: enabled && revision !== undefined,
    staleTime: Infinity,
  });
  const activity = useQuery({
    queryKey: [...key, "activity"],
    queryFn: async ({ signal }) => ({
      ...await dependencyTreeApi.activity(teamId, signal),
      receivedAt: Date.now(),
    }),
    enabled,
    refetchInterval: 3_000,
  });
  const register = useMutation({
    mutationFn: (input) => dependencyTreeApi.register(teamId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...key, "repositories"] }),
  });
  return { repositories, graph, activity, register };
}
