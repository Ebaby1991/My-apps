import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  // Nodes
  listNodes: () => client.get("/nodes").then((r) => r.data),
  createNode: (body) => client.post("/nodes", body).then((r) => r.data),
  updateNode: (id, body) => client.patch(`/nodes/${id}`, body).then((r) => r.data),
  deleteNode: (id) => client.delete(`/nodes/${id}`).then((r) => r.data),
  checkNode: (id) => client.post(`/nodes/${id}/check`).then((r) => r.data),
  checkAll: () => client.post(`/nodes/check-all`).then((r) => r.data),

  // Deployment
  generateCompose: (body) =>
    client.post("/deploy/docker-compose", body, { responseType: "text" }).then((r) => r.data),
  generateBulkScript: (body) =>
    client.post("/deploy/bulk-script", body, { responseType: "text" }).then((r) => r.data),
  generateStack: (body) =>
    client.post("/deploy/stack", body, { responseType: "text" }).then((r) => r.data),
  generateStackBootstrap: (body) =>
    client.post("/deploy/stack-bootstrap", body, { responseType: "text" }).then((r) => r.data),
  catalog: () => client.get("/networks/catalog").then((r) => r.data),

  // Prices
  prices: () => client.get("/prices").then((r) => r.data),
  refreshPrices: () => client.post("/prices/refresh").then((r) => r.data),

  // Referrals + Advisor
  listReferrals: () => client.get("/referrals").then((r) => r.data),
  saveReferrals: (list) => client.put("/referrals", list).then((r) => r.data),
  referralUrls: () => client.get("/referrals/urls").then((r) => r.data),
  advisor: () => client.get("/advisor/recommendations").then((r) => r.data),

  // Earnings
  listEarnings: () => client.get("/earnings").then((r) => r.data),
  createEarning: (body) => client.post("/earnings", body).then((r) => r.data),
  deleteEarning: (id) => client.delete(`/earnings/${id}`).then((r) => r.data),

  // Stats
  summary: () => client.get("/stats/summary").then((r) => r.data),
  networkInfo: () => client.get("/network/info").then((r) => r.data),
  grassBalance: (wallet) =>
    client.get(`/wallet/grass-balance/${wallet}`).then((r) => r.data),
};
