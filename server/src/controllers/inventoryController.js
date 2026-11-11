import mongoose from "mongoose";
import { InventoryItem } from "../models/InventoryItem.js";
import { InventoryMovement } from "../models/InventoryMovement.js";
import { isValidObjectId } from "../utils/query.js";

export async function adjustInventory(req, res, next) {
  let session;
  try {
    const { id } = req.params;
    const type = String(req.body?.type || "");
    const quantity = Number(req.body?.quantity);
    const reason = String(req.body?.reason || "").trim();
    const reference = String(req.body?.reference || "").trim().slice(0, 120);
    if (!isValidObjectId(id)) return res.status(400).json({ message: "A valid inventory item ID is required" });
    if (!["receipt", "issue", "adjustment"].includes(type)) return res.status(400).json({ message: "Choose receipt, issue, or adjustment" });
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) return res.status(400).json({ message: "Quantity must be greater than zero" });
    if (!reason || reason.length > 300) return res.status(400).json({ message: "A reason of up to 300 characters is required" });

    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      const item = await InventoryItem.findById(id).session(session).select("quantity");
      if (!item) {
        const error = new Error("Inventory item not found");
        error.statusCode = 404;
        throw error;
      }
      const previousQuantity = Number(item.quantity || 0);
      const newQuantity = type === "receipt" ? previousQuantity + quantity : type === "issue" ? previousQuantity - quantity : quantity;
      if (newQuantity < 0) {
        const error = new Error("Stock cannot become negative");
        error.statusCode = 409;
        throw error;
      }
      const updated = await InventoryItem.findOneAndUpdate(
        { _id: id, quantity: previousQuantity },
        { $set: { quantity: newQuantity } },
        { new: true, runValidators: true, session }
      );
      if (!updated) {
        const error = new Error("Stock changed during this adjustment. Refresh and try again.");
        error.statusCode = 409;
        throw error;
      }
      const [movement] = await InventoryMovement.create([{
        item: id, type, quantity, previousQuantity, newQuantity, reason,
        reference: reference || undefined, performedBy: req.user._id
      }], { session });
      result = { item: updated, movement };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return res.status(201).json(result);
  } catch (error) {
    if (error.code === 20 || /Transaction numbers are only allowed|replica set|mongos/i.test(error.message || "")) {
      error.statusCode = 503;
      error.message = "Inventory movements require MongoDB transaction support (replica set or sharded cluster). No stock change was committed.";
    }
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

export async function listInventoryMovements(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "A valid inventory item ID is required" });
    const movements = await InventoryMovement.find({ item: id }).populate("performedBy", "name email").sort({ createdAt: -1 }).limit(100).lean();
    return res.json(movements);
  } catch (error) { return next(error); }
}
