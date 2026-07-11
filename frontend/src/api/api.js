import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ---------- Sensors ----------
export const listSensors  = () => api.get("/sensors").then(r => r.data);
export const getSensor    = (id) => api.get(`/sensors/${id}`).then(r => r.data);

// ---------- Predictions ----------
export const getSummary   = () => api.get("/predictions/summary").then(r => r.data);
export const getClimate   = (sample = 50) =>
  api.get("/predictions/climate", { params: { sample } }).then(r => r.data);

export const listDiseases = (params = {}) =>
  api.get("/predictions/disease", { params }).then(r => r.data);

export const getDisease   = (id) =>
  api.get(`/predictions/disease/${id}`).then(r => r.data);

export const listYields   = (params = {}) =>
  api.get("/predictions/yield", { params }).then(r => r.data);

// ---------- Alerts ----------
export const listAlerts   = (params = {}) => api.get("/alerts", { params }).then(r => r.data);
export const markAlertRead    = (id) => api.patch(`/alerts/${id}/read`).then(r => r.data);
export const dismissAlert     = (id) => api.patch(`/alerts/${id}/dismiss`).then(r => r.data);
export const deleteAlert      = (id) => api.delete(`/alerts/${id}`).then(r => r.data);
export const markAllAlertsRead = (params = {}) =>
  api.patch("/alerts/read-all", null, { params }).then(r => r.data);

// ---------- Images (return URLs the browser fetches directly) ----------
export const rawImageUrl       = (sensorImageId) => `/api/v1/images/${sensorImageId}/raw`;
export const annotatedImageUrl = (sensorImageId) => `/api/v1/images/${sensorImageId}/annotated`;

// ---------- Watcher ----------
export const watcherStatus = () => api.get("/watcher/status").then(r => r.data);

// ---------- Advisory (Ollama LLM) ----------
export const advisoryHealth  = () => api.get("/advisory/health").then(r => r.data);
export const advisoryContext = () => api.get("/advisory/context").then(r => r.data);

/**
 * Stream chat completions from /advisory/chat. The backend yields plain-text
 * chunks; this generator yields each chunk as it arrives. Returns an async
 * iterator the caller drives with `for await`.
 */
export async function* streamAdvisoryChat({ messages, lang, signal }) {
  const res = await fetch("/api/v1/advisory/chat", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages, lang }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: HTTP ${res.status}`);
  }
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) yield chunk;
  }
}

export default api;
