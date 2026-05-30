import { supabase } from "./supabaseClient";

const jsonHeaders = { "Content-Type": "application/json" };
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

function apiUrl(path) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const looksLikeHtml = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html");
  if (looksLikeHtml) {
    throw new Error(
      `The API returned an HTML page instead of JSON. Check VITE_API_BASE_URL and the backend deployment URL. Status: ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return text ? { message: text } : {};
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const nextHeaders = {
    ...jsonHeaders,
    ...(await authHeaders()),
    ...options.headers,
  };
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: nextHeaders,
  });
  const data = await parseResponse(response);
  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error(data.message || "Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(apiUrl("/api/uploads/image"), {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const data = await parseResponse(response);
  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error(data.message || "Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.message || "Upload failed");
  return data;
}

async function uploadForSmartSave(file, path) {
  const formData = new FormData();
  formData.append("image", file);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: await authHeaders(),
      body: formData,
      signal: controller.signal,
    });
    const data = await parseResponse(response);
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error(data.message || "Your session expired. Please sign in again.");
    }
    if (!response.ok) throw new Error(data.message || "Smart Save failed");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Smart Save timed out. Try a smaller image or a stronger connection.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function smartSaveUpload(file) {
  return uploadForSmartSave(file, "/api/ai/smart-save-upload");
}

async function autonomousSaveUpload(file) {
  return uploadForSmartSave(file, "/api/ai/autonomous-save-upload");
}

export const api = {
  getMe: () => request("/api/me"),
  updateProfile: (payload) => request("/api/me/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  searchUsers: ({ query = "", page = 1 } = {}) => {
    const params = new URLSearchParams({ q: query, page: String(page) });
    return request(`/api/users?${params.toString()}`);
  },
  getPublicProfile: (username) => request(`/api/users/${encodeURIComponent(username)}`),
  getPublicUserBoards: (username) => request(`/api/users/${encodeURIComponent(username)}/boards`),
  getPublicUserBoard: (username, boardId) => request(`/api/users/${encodeURIComponent(username)}/boards/${boardId}`),
  getBoards: () => request("/api/boards"),
  createBoard: (payload) => request("/api/boards", { method: "POST", body: JSON.stringify(payload) }),
  updateBoard: (boardId, payload) => request(`/api/boards/${boardId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateBoardVisibility: (boardId, visibility) =>
    request(`/api/boards/${boardId}/visibility`, { method: "PATCH", body: JSON.stringify({ visibility }) }),
  deleteBoard: (boardId) => request(`/api/boards/${boardId}`, { method: "DELETE" }),
  getBoard: (id) => request(`/api/boards/${id}`),
  searchLibrary: ({ query, provider = "pexels", page = 1 }) => {
    const params = new URLSearchParams({
      q: query || "creative inspiration",
      provider,
      page: String(page),
    });
    return request(`/api/library/search?${params.toString()}`);
  },
  uploadImage,
  smartSaveUpload,
  autonomousSaveUpload,
  predict: (payload) => request("/api/predict", { method: "POST", body: JSON.stringify(payload) }),
  aiPredictBoard: (payload) => request("/api/ai/predict-board", { method: "POST", body: JSON.stringify(payload) }),
  aiAnalyzeImage: (payload) => request("/api/ai/analyze-image", { method: "POST", body: JSON.stringify(payload) }),
  aiAutoSave: (payload) => request("/api/ai/auto-save", { method: "POST", body: JSON.stringify(payload) }),
  aiAutonomousSave: (payload) => request("/api/ai/autonomous-save", { method: "POST", body: JSON.stringify(payload) }),
  aiConfirmSave: (payload) => request("/api/ai/confirm-save", { method: "POST", body: JSON.stringify(payload) }),
  aiCreateBoardAndSave: (payload) =>
    request("/api/ai/create-board-and-save", { method: "POST", body: JSON.stringify(payload) }),
  getPinterestStatus: () => request("/api/pinterest/status"),
  updateBoardPinterest: (boardId, pinterestBoardId) =>
    request(`/api/boards/${boardId}/pinterest`, {
      method: "PATCH",
      body: JSON.stringify({ pinterestBoardId }),
    }),
  publishPinterestPin: (pinId, payload = {}) =>
    request(`/api/pinterest/publish/${pinId}`, { method: "POST", body: JSON.stringify(payload) }),
  savePin: (payload) => request("/api/pins", { method: "POST", body: JSON.stringify(payload) }),
  updatePin: (pinId, payload) => request(`/api/pins/${pinId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePin: (pinId) => request(`/api/pins/${pinId}`, { method: "DELETE" }),
  movePin: (pinId, boardId) =>
    request(`/api/pins/${pinId}/board`, { method: "PATCH", body: JSON.stringify({ boardId }) }),
  undoAutonomousSave: (payload) =>
    request("/api/ai/undo-autonomous-save", { method: "POST", body: JSON.stringify(payload) }),
  getRecommendations: (boardId) => request(`/api/recommendations/${boardId}`),
};
