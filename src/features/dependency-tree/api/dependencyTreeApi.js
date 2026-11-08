import { apiClient } from "@/lib/apiClient";

export const dependencyTreeApi = {
  list: (teamId, signal) => apiClient.get(`/teams/${teamId}/git/dependency-graphs`, signal),
  graph: (teamId, signal) => apiClient.get(`/teams/${teamId}/git/dependency-graph`, signal),
  activity: (teamId, signal) => apiClient.get(`/teams/${teamId}/git/dependency-graph/activity`, signal),
  register: (teamId, source) => apiClient.post(`/teams/${teamId}/git/dependency-sources`, source),
};
