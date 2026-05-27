const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: jsonHeaders,
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const api = {
  getBoards: () => request("/api/boards"),
  createBoard: (payload) => request("/api/boards", { method: "POST", body: JSON.stringify(payload) }),
  getBoard: (id) => request(`/api/boards/${id}`),
  predict: (payload) => request("/api/predict", { method: "POST", body: JSON.stringify(payload) }),
  savePin: (payload) => request("/api/pins", { method: "POST", body: JSON.stringify(payload) }),
  movePin: (pinId, boardId) =>
    request(`/api/pins/${pinId}/board`, { method: "PATCH", body: JSON.stringify({ boardId }) }),
  getRecommendations: (boardId) => request(`/api/recommendations/${boardId}`),
};
