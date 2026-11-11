import express from "express";
import { permit } from "../middleware/auth.js";
export function crudRoutes(controller, { read = [], write = read, create = write, update = write, remove = write } = {}) {
  const router = express.Router();
  router.route("/").get(permit(...read), controller.list).post(permit(...create), controller.create);
  router.route("/:id").get(permit(...read), controller.get).put(permit(...update), controller.update).delete(permit(...remove), controller.remove);
  return router;
}
