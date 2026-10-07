// En dev / preview avec proxy Vite: laisser vide (defaut "/api").
// Si vous servez le build sans proxy: definir VITE_API_BASE_URL au build, ex. http://127.0.0.1:8000/api
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

/** Routes accessibles sans token (pas d'en-tete Authorization). */
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/seed",
  "/accounts/reactivate-demo",
];

function normalizePath(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.split("?")[0];
}

function isPublicPath(path) {
  const p = normalizePath(path);
  return PUBLIC_PATHS.includes(p);
}

export function clearAuthToken() {
  localStorage.removeItem("token");
}

const SESSION_EXPIRED_MSG = "Session expiree. Reconnectez-vous.";

function notifyAuthExpired() {
  clearAuthToken();
  window.dispatchEvent(
    new CustomEvent("grh:auth-expired", {
      detail: { message: SESSION_EXPIRED_MSG },
    })
  );
}

export async function api(path, options = {}) {
  const publicRoute = isPublicPath(path);
  const token = publicRoute ? null : (localStorage.getItem("token") || "").trim() || null;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Impossible de contacter le serveur API (http://127.0.0.1:8000). Demarrez le backend PHP puis reessayez."
    );
  }

  const rawText = await response.text().catch(() => "");
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      (typeof rawText === "string" && rawText.trim()
        ? `Erreur API (${response.status})`
        : null) ||
      `Erreur API (${response.status})`;

    if (
      !publicRoute &&
      response.status === 401 &&
      /token\s*(manquant|invalide)/i.test(message)
    ) {
      notifyAuthExpired();
      throw new Error(SESSION_EXPIRED_MSG);
    }

    throw new Error(message);
  }
  return data;
}

export async function login(email, password) {
  clearAuthToken();
  const result = await api("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result?.token) {
    localStorage.setItem("token", String(result.token).trim());
  }
  if (result?.permissions) {
    localStorage.setItem("grh_permissions", JSON.stringify(result.permissions));
  }
  return result;
}

export async function logout() {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await api("/logout", { method: "POST" });
    } catch {
      /* ignore: token deja invalide cote serveur */
    }
  }
  clearAuthToken();
  localStorage.removeItem("grh_permissions");
}

export async function getPermissionsCatalog() {
  return api("/permissions");
}

export async function getUserPermissions(userId) {
  return api(`/admin/users/${userId}/permissions`);
}

export async function updateUserPermissions(userId, permissions) {
  return api(`/admin/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export async function forgotPassword(email) {
  return api("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email, token, password, password_confirmation) {
  return api("/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, password, password_confirmation }),
  });
}

export async function getAdminDashboard() {
  return api("/admin/dashboard");
}

export async function getAdminNotifications() {
  return api("/admin/notifications");
}

export async function getAdminReport(type, format = "json") {
  if (format === "csv") {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE}/admin/reports/${type}?format=csv`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } }
    );
    if (response.status === 401) {
      notifyAuthExpired();
      throw new Error(SESSION_EXPIRED_MSG);
    }
    if (!response.ok) throw new Error("Export impossible");
    return response.text();
  }
  return api(`/admin/reports/${type}`);
}

export async function createAdminEmployee(payload) {
  return api("/admin/employees", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateAdminEmployee(id, payload) {
  return api(`/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteAdminEmployee(id) {
  return api(`/admin/employees/${id}`, { method: "DELETE" });
}

export async function getAdminLogs() {
  return api("/admin/logs");
}

export async function createAdminUser(payload) {
  return api("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      permissions: payload.permissions || undefined,
    }),
  });
}

export async function updateAdminUser(id, payload) {
  return api(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateUserRole(id, role) {
  return api(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserAccess(id, active) {
  return api(`/admin/users/${id}/access`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function deleteUser(id) {
  return api(`/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function updateRoleProfile(role, payload) {
  const body =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? {
          responsibilities: payload.responsibilities ?? [],
          permissions: payload.permissions ?? [],
          ...(payload.description !== undefined ? { description: payload.description } : {}),
        }
      : { responsibilities: payload || [], permissions: arguments[2] || [] };

  return api(`/admin/roles/${role}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function updateAdminSettings(settings) {
  return api("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function getHrLeaveRequests() {
  return api("/hr/leave-requests");
}

export async function patchHrLeaveRequest(id, status) {
  return api(`/hr/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getHrRecruitment() {
  return api("/hr/recruitment");
}

export async function createHrRecruitment(payload) {
  return api("/hr/recruitment", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchHrRecruitment(id, payload) {
  return api(`/hr/recruitment/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteHrRecruitment(id) {
  return api(`/hr/recruitment/${id}`, { method: "DELETE" });
}

export async function getHrEvaluations() {
  return api("/hr/evaluations");
}

export async function createHrEvaluation(payload) {
  return api("/hr/evaluations", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchHrEvaluation(id, payload) {
  return api(`/hr/evaluations/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteHrEvaluation(id) {
  return api(`/hr/evaluations/${id}`, { method: "DELETE" });
}

export async function getHrTrainings() {
  return api("/hr/trainings");
}

export async function createHrTraining(payload) {
  return api("/hr/trainings", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchHrTraining(id, payload) {
  return api(`/hr/trainings/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteHrTraining(id) {
  return api(`/hr/trainings/${id}`, { method: "DELETE" });
}

export async function getHrCareers() {
  return api("/hr/careers");
}

export async function createHrCareer(payload) {
  return api("/hr/careers", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchHrCareer(id, payload) {
  return api(`/hr/careers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteHrCareer(id) {
  return api(`/hr/careers/${id}`, { method: "DELETE" });
}

export async function getHrEmployees() {
  return api("/hr/employees");
}

export async function patchHrEmployeeProfile(id, payload) {
  return api(`/hr/employees/${id}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getEmployeeEvaluations() {
  return api("/employee/evaluations");
}

export async function participateEmployeeEvaluation(id, payload) {
  return api(`/employee/evaluations/${id}/participation`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getEmployeeCareer() {
  return api("/employee/career");
}

export async function getEmployeeHrInfoRequests() {
  return api("/employee/hr-info-requests");
}

export async function createEmployeeHrInfoRequest(payload) {
  return api("/employee/hr-info-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getHrDashboard() {
  return api("/hr/dashboard");
}

export async function getHrInfoRequests() {
  return api("/hr/info-requests");
}

export async function patchHrInfoRequest(id, payload) {
  return api(`/hr/info-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getEmployeeTrainings() {
  return api("/employee/trainings");
}

export async function enrollEmployeeTraining(id) {
  return api(`/employee/trainings/${id}/enroll`, { method: "POST" });
}
