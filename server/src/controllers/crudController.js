function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export function makeCrudController(Model, defaultPopulate = []) {
  const applyPopulate = (query) => defaultPopulate.reduce((current, path) => current.populate(path), query);

  return {
    async list(req, res, next) {
      try {
        const { status, q, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (q) {
          const safeQuery = escapeRegex(String(q).trim().slice(0, 80));
          const expression = new RegExp(safeQuery, "i");
          filter.$or = [
            { fullName: expression },
            { mrn: expression },
            { phone: expression },
            { name: expression },
            { patientName: expression },
            { sourceName: expression },
            { invoiceNo: expression },
            { category: expression },
            { department: expression },
            { service: expression },
            { title: expression }
          ];
        }
        const docs = await applyPopulate(Model.find(filter)).sort({ createdAt: -1 }).limit(parseLimit(limit));
        res.json(docs);
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        const doc = await Model.create(req.body);
        res.status(201).json(doc);
      } catch (error) {
        next(error);
      }
    },

    async get(req, res, next) {
      try {
        const doc = await applyPopulate(Model.findById(req.params.id));
        if (!doc) {
          res.status(404);
          throw new Error("Record not found");
        }
        res.json(doc);
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          runValidators: true,
          context: "query"
        });
        if (!doc) {
          res.status(404);
          throw new Error("Record not found");
        }
        res.json(doc);
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const doc = await Model.findByIdAndDelete(req.params.id);
        if (!doc) {
          res.status(404);
          throw new Error("Record not found");
        }
        res.json({ message: "Record deleted" });
      } catch (error) {
        next(error);
      }
    }
  };
}
