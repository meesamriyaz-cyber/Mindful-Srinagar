export function escapeRegex(value) {
  return String(value).replace(/[|\\{}()[\]^$+*?.\/-]/g, "\\$&");
}
export function parseLimit(value, fallback = 50, maximum = 100) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), maximum);
}
export function isValidObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}
export function sanitizePayload(body, allowedFields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be a JSON object");
    error.statusCode = 400;
    throw error;
  }
  const unknownFields = Object.keys(body).filter((key) => !allowedFields.includes(key));
  if (unknownFields.length) {
    const error = new Error("Unsupported field(s): " + unknownFields.join(", "));
    error.statusCode = 400;
    throw error;
  }
  const payload = Object.fromEntries(Object.entries(body).filter(([key, value]) => allowedFields.includes(key) && value !== undefined));
  if (!Object.keys(payload).length) {
    const error = new Error("At least one valid field is required");
    error.statusCode = 400;
    throw error;
  }
  return payload;
}
