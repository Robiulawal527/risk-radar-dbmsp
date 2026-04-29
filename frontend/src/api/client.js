const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  getCrimes: (params = {}) => request(`/crimes?${new URLSearchParams(params)}`),
  getHeatmap: (params = {}) => request(`/heatmap?${new URLSearchParams(params)}`),
  getDashboard: () => request("/dashboard"),
};
