import { escapeRegex, isValidObjectId, parseLimit, sanitizePayload } from "../utils/query.js";
export function makeCrudController(Model, defaultPopulate = [], policy = {}) {
  const applyPopulate = (query) => defaultPopulate.reduce((current, path) => current.populate(path), query);
  const createFields = policy.createFields || [];
  const updateFields = policy.updateFields || createFields;
  const filterFields = policy.filterFields || ["status"];
  const searchableFields = policy.searchableFields || [];
  const filterAliases = policy.filterAliases || {};
  const listScope = policy.listScope || (() => ({}));
  const recordScope = policy.recordScope || (() => ({}));
  return {
    async list(req, res, next) {
      try {
        const { status, q, limit = 50, ...extraFilters } = req.query;
        const filter = { ...listScope(req) };
        if (status && filterFields.includes("status")) filter.status = status;
        for (const [key, value] of Object.entries(extraFilters)) {
          const field = filterAliases[key] || key;
          if (!filterFields.includes(field)) return res.status(400).json({ message: "Unsupported filter: " + key });
          if (value !== undefined && value !== null && value !== "") filter[field] = value;
        }
        if (q && searchableFields.length) {
          const expression = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
          filter.$or = searchableFields.map((field) => ({ [field]: expression }));
        }
        return res.json(await applyPopulate(Model.find(filter)).sort({ createdAt: -1 }).limit(parseLimit(limit)));
      } catch (error) { return next(error); }
    },
    async create(req, res, next) {
      try { return res.status(201).json(await Model.create(sanitizePayload(req.body, createFields))); }
      catch (error) { return next(error); }
    },
    async get(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const doc = await applyPopulate(Model.findOne({ _id: req.params.id, ...recordScope(req) }));
        if (!doc) return res.status(404).json({ message: "Record not found" });
        return res.json(doc);
      } catch (error) { return next(error); }
    },
    async update(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const allowed = policy.updateFieldsByRole?.[req.user.role] || updateFields;
        const payload = sanitizePayload(req.body, allowed);
        const doc = await Model.findOneAndUpdate({ _id: req.params.id, ...recordScope(req) }, { $set: payload }, {
          new: true, runValidators: true, context: "query"
        });
        if (!doc) return res.status(404).json({ message: "Record not found" });
        return res.json(doc);
      } catch (error) { return next(error); }
    },
    async remove(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const doc = await Model.findOneAndDelete({ _id: req.params.id, ...recordScope(req) });
        if (!doc) return res.status(404).json({ message: "Record not found" });
        return res.json({ message: "Record deleted" });
      } catch (error) { return next(error); }
    }
  };
}
