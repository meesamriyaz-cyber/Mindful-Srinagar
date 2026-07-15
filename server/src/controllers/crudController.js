export function makeCrudController(Model, defaultPopulate = []) {
  const applyPopulate = (query) => defaultPopulate.reduce((current, path) => current.populate(path), query);

  return {
    async list(req, res, next) {
      try {
        const { status, q, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (q) {
          filter.$or = [
            { fullName: new RegExp(q, "i") },
            { name: new RegExp(q, "i") },
            { patientName: new RegExp(q, "i") },
            { sourceName: new RegExp(q, "i") },
            { title: new RegExp(q, "i") }
          ];
        }
        const docs = await applyPopulate(Model.find(filter)).sort({ createdAt: -1 }).limit(Number(limit));
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
          runValidators: true
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
