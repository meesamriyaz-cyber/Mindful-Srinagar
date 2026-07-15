import express from "express";

export function crudRoutes(controller) {
  const router = express.Router();
  router.route("/").get(controller.list).post(controller.create);
  router.route("/:id").get(controller.get).put(controller.update).delete(controller.remove);
  return router;
}
