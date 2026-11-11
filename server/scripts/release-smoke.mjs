const baseUrl = String(process.env.RELEASE_BASE_URL || "").replace(/\/+$/, "");
const email = process.env.RELEASE_TEST_EMAIL || "";
const password = process.env.RELEASE_TEST_PASSWORD || "";
const role = String(process.env.RELEASE_TEST_ROLE || "").toLowerCase();

const roleChecks = {
  director: { allowed: ["/dashboard", "/patients?limit=1", "/invoices?limit=1", "/inventory?limit=1"], denied: [] },
  admin: { allowed: ["/dashboard", "/patients?limit=1", "/invoices?limit=1", "/inventory?limit=1"], denied: [] },
  reception: { allowed: ["/dashboard", "/patients?limit=1", "/appointments?limit=1", "/referrals?limit=1"], denied: ["/inventory?limit=1"] },
  doctor: { allowed: ["/dashboard/practitioner", "/patients?limit=1", "/appointments?limit=1", "/assessments?limit=1"], denied: ["/invoices?limit=1"] },
  therapist: { allowed: ["/dashboard/practitioner", "/patients?limit=1", "/appointments?limit=1", "/assessments?limit=1"], denied: ["/invoices?limit=1"] },
  accounts: { allowed: ["/invoices?limit=1", "/tasks?limit=1"], denied: ["/patients?limit=1"] },
  coordinator: { allowed: ["/patients?limit=1", "/appointments?limit=1", "/tasks?limit=1", "/inventory?limit=1"], denied: ["/dashboard"] }
};

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
}

if (!baseUrl || !email || !password || !role) {
  console.error("Set RELEASE_BASE_URL, RELEASE_TEST_EMAIL, RELEASE_TEST_PASSWORD and RELEASE_TEST_ROLE.");
  process.exit(2);
}
if (!roleChecks[role]) {
  console.error("RELEASE_TEST_ROLE must be one of: " + Object.keys(roleChecks).join(", "));
  process.exit(2);
}

async function request(path, options = {}) {
  return fetch(baseUrl + "/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
}

try {
  const health = await request("/health");
  if (!health.ok) throw new Error("API health check returned HTTP " + health.status);
  const healthBody = await health.json();
  if (healthBody.status !== "ok") throw new Error("API health payload was not healthy");

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (!login.ok) throw new Error("Staff login returned HTTP " + login.status);
  const session = await login.json();
  if (!session.token || session.user?.role !== role) throw new Error("Login role did not match RELEASE_TEST_ROLE");

  const headers = { Authorization: "Bearer " + session.token };
  for (const path of roleChecks[role].allowed) {
    const response = await request(path, { headers });
    if (!response.ok) fail("Expected " + path + " to be accessible; received HTTP " + response.status);
    else console.log("PASS allowed " + path);
  }
  for (const path of roleChecks[role].denied) {
    const response = await request(path, { headers });
    if (response.status !== 403) fail("Expected " + path + " to be forbidden; received HTTP " + response.status);
    else console.log("PASS denied " + path);
  }
  if (!process.exitCode) console.log("Release smoke checks passed for role: " + role);
} catch (error) {
  fail(error.message || "Release smoke checks could not complete");
}
