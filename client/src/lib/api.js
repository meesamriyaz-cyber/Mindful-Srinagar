const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");
const TOKEN_KEY = "mindful_staff_token";
const USER_KEY = "mindful_staff_user";

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A blocked storage write should not break the staff workflow after login.
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures from restricted browser modes.
  }
}

function buildApiUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

export function getStoredSession() {
  const token = readStorage(TOKEN_KEY);
  const rawUser = readStorage(USER_KEY);
  try {
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null
    };
  } catch {
    clearSession();
    return { token: null, user: null };
  }
}

export function storeSession({ token, user }) {
  writeStorage(TOKEN_KEY, token);
  writeStorage(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  removeStorage(TOKEN_KEY);
  removeStorage(USER_KEY);
}

export async function apiRequest(path, { token, params, timeoutMs = 12000, ...options } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const url = buildApiUrl(path, params);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The centre system took too long to respond. Please call the centre directly.");
    }
    throw new Error("Could not reach the centre system. Please check the connection and try again.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function loginStaff(credentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function createEnquiry(enquiry) {
  return apiRequest("/enquiries", {
    method: "POST",
    body: JSON.stringify(enquiry)
  });
}

export function listRecords(resource, { token, q, status, limit = 30 } = {}) {
  return apiRequest(`/${resource}`, {
    token,
    params: { q, status, limit }
  });
}

export function updateRecord(resource, id, updates, { token } = {}) {
  return apiRequest(`/${resource}/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export function listAssessments({ token, patientId, q, status, limit = 30 } = {}) {
  return apiRequest("/assessments", {
    token,
    params: { patientId, q, status, limit }
  });
}

export function createAssessment(data, { token } = {}) {
  return apiRequest("/assessments", {
    token,
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getAssessment(id, { token } = {}) {
  return apiRequest(`/assessments/${id}`, { token });
}

export function updateAssessment(id, updates, { token } = {}) {
  return apiRequest(`/assessments/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export function listTreatmentPlans({ token, patientId, q, status, limit = 30 } = {}) {
  return apiRequest("/treatment-plans", {
    token,
    params: { patientId, q, status, limit }
  });
}

export function createTreatmentPlan(data, { token } = {}) {
  return apiRequest("/treatment-plans", {
    token,
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getTreatmentPlan(id, { token } = {}) {
  return apiRequest(`/treatment-plans/${id}`, { token });
}

export function updateTreatmentPlan(id, updates, { token } = {}) {
  return apiRequest(`/treatment-plans/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export function listProgressNotes({ token, patientId, appointmentId, q, limit = 30 } = {}) {
  return apiRequest("/progress-notes", {
    token,
    params: { patientId, appointmentId, q, limit }
  });
}

export function createProgressNote(data, { token } = {}) {
  return apiRequest("/progress-notes", {
    token,
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getProgressNote(id, { token } = {}) {
  return apiRequest(`/progress-notes/${id}`, { token });
}

export function updateProgressNote(id, updates, { token } = {}) {
  return apiRequest(`/progress-notes/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(updates)
  });
}

export function listPrescriptions({ token, patientId, q, status, limit = 30 } = {}) {
  return apiRequest("/prescriptions", {
    token,
    params: { patientId, q, status, limit }
  });
}

export function createPrescription(data, { token } = {}) {
  return apiRequest("/prescriptions", {
    token,
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getPrescription(id, { token } = {}) {
  return apiRequest(`/prescriptions/${id}`, { token });
}

export function updatePrescription(id, updates, { token } = {}) {
  return apiRequest(`/prescriptions/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(updates)
  });
}
