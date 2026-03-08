const API_BASE_URL = "http://localhost:3000";
const FALLBACK_TOKEN = "Mjplc3RvcXVlQHZhcmVqb3N5bmMuY29t";

function getAuthToken() {
  return (localStorage.getItem("token") || "").trim();
}

function setAuthToken(token) {
  localStorage.setItem("token", token);
}

function clearAuthToken() {
  localStorage.removeItem("token");
}

function getEffectiveToken() {
  return getAuthToken() || FALLBACK_TOKEN;
}

async function apiRequest(path, options = {}) {
  const token = getEffectiveToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log("=== API DEBUG ===");
  console.log("PATH:", path);
  console.log("TOKEN EFETIVO:", token);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const responseText = await response.text();
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { raw: responseText };
  }

  console.log("STATUS:", response.status);
  console.log("RESPOSTA:", data);

  if (!response.ok) {
    throw new Error(
      data.erro ||
        data.error ||
        data.message ||
        data.raw ||
        `Erro HTTP ${response.status}`,
    );
  }

  return data;
}

async function apiGet(path) {
  return apiRequest(path, { method: "GET" });
}

async function apiPost(path, body) {
  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function apiPut(path, body) {
  return apiRequest(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function apiDelete(path) {
  return apiRequest(path, {
    method: "DELETE",
  });
}
