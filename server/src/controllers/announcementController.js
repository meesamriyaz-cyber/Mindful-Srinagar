import { Announcement } from "../models/Announcement.js";

const fields = ["enabled", "eyebrow", "title", "message", "actionLabel", "actionUrl", "style", "displayMode", "toastDuration", "dailyFrequency", "startsAt", "endsAt"];

function normalize(payload) {
  const value = {};
  for (const field of fields) if (payload[field] !== undefined) value[field] = payload[field];
  for (const field of ["eyebrow", "title", "message", "actionLabel", "actionUrl"]) {
    if (value[field] !== undefined) value[field] = String(value[field] || "").trim();
  }
  if (value.startsAt === "") value.startsAt = null;
  if (value.endsAt === "") value.endsAt = null;
  return value;
}

function validate(value) {
  if (value.title !== undefined && value.title.length > 100) return "Announcement title must be 100 characters or fewer";
  if (value.message !== undefined && value.message.length > 280) return "Announcement message must be 280 characters or fewer";
  if (value.style !== undefined && !["notice", "event", "urgent"].includes(value.style)) return "Select a valid announcement style";
  if (value.displayMode !== undefined && !["persistent", "toast"].includes(value.displayMode)) return "Select a valid announcement display behaviour";
  if (value.toastDuration !== undefined && ![10, 15, 20, 30].includes(Number(value.toastDuration))) return "Toast duration must be 10, 15, 20 or 30 seconds";
  if (value.dailyFrequency !== undefined && !["once", "twice"].includes(value.dailyFrequency)) return "Select once or twice daily";
  if (value.actionUrl) {
    const isAnchor = /^#[a-z][a-z0-9_-]*$/i.test(value.actionUrl);
    let isWebUrl = false;
    try { const url = new URL(value.actionUrl); isWebUrl = ["http:", "https:"].includes(url.protocol); } catch {}
    if (!isAnchor && !isWebUrl) return "Action link must be a website URL or an on-page section link such as #contact";
  }
  if (value.startsAt && Number.isNaN(new Date(value.startsAt).getTime())) return "Enter a valid announcement start date";
  if (value.endsAt && Number.isNaN(new Date(value.endsAt).getTime())) return "Enter a valid announcement end date";
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) return "End date must be later than the start date";
  return null;
}

export async function getPublicAnnouncement(_req, res, next) {
  try {
    const item = await Announcement.findOne({ key: "hero", enabled: true }).lean();
    if (!item) return res.json({ announcement: null });
    const now = Date.now();
    if ((item.startsAt && new Date(item.startsAt).getTime() > now) || (item.endsAt && new Date(item.endsAt).getTime() < now)) {
      return res.json({ announcement: null });
    }
    return res.json({ announcement: {
      eyebrow: item.eyebrow, title: item.title, message: item.message,
      actionLabel: item.actionLabel, actionUrl: item.actionUrl, style: item.style,
      displayMode: item.displayMode || "persistent", toastDuration: item.toastDuration || 15,
      dailyFrequency: item.dailyFrequency || "once", version: item.updatedAt || item.createdAt || null
    } });
  } catch (error) { return next(error); }
}

export async function getAnnouncement(_req, res, next) {
  try {
    const item = await Announcement.findOne({ key: "hero" }).lean();
    return res.json({ announcement: item || {
      key: "hero", enabled: false, eyebrow: "IMPORTANT ANNOUNCEMENT", title: "", message: "",
      actionLabel: "", actionUrl: "", style: "notice", displayMode: "persistent", toastDuration: 15, dailyFrequency: "once", startsAt: null, endsAt: null
    } });
  } catch (error) { return next(error); }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !fields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const value = normalize(payload);
    const validationError = validate(value);
    if (validationError) return res.status(400).json({ message: validationError });
    if (value.enabled && (!value.title || !value.message)) return res.status(400).json({ message: "Add an announcement title and message before publishing" });
    const announcement = await Announcement.findOneAndUpdate(
      { key: "hero" },
      { $set: { ...value, updatedBy: req.user._id }, $setOnInsert: { key: "hero" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ announcement });
  } catch (error) { return next(error); }
}
