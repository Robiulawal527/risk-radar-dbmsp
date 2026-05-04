const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function postRequest(path, data) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function putRequest(path, data) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  getCrimes: (params = {}) => request(`/crimes?${new URLSearchParams(params)}`),
  getHeatmap: (params = {}) => request(`/heatmap?${new URLSearchParams(params)}`),
  getDashboard: () => request("/dashboard"),
  getProfiles: (params = {}) => request(`/profiles?${new URLSearchParams(params)}`),
  getProfileByNid: (nid) => request(`/profiles/${nid}`),
  saveProfile: (data) => postRequest("/profiles", data),
  recordAction: (data) => postRequest("/profiles/action", data),
  updateProfile: (nid, data) => putRequest(`/profiles/${nid}`, data),
};
