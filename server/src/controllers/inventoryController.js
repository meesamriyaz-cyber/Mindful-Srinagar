import { InventoryItem } from "../models/InventoryItem.js";
import { InventoryMovement } from "../models/InventoryMovement.js";
import { isValidObjectId } from "../utils/query.js";

export async function adjustInventory(req, res, next) {
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

    const item = await InventoryItem.findById(id).select("quantity");
    if (!item) return res.status(404).json({ message: "Inventory item not found" });
    const previousQuantity = Number(item.quantity || 0);
    const newQuantity = type === "receipt" ? previousQuantity + quantity : type === "issue" ? previousQuantity - quantity : quantity;
    if (newQuantity < 0) return res.status(409).json({ message: "Stock cannot become negative" });

    const updated = await InventoryItem.findOneAndUpdate(
      { _id: id, quantity: previousQuantity },
      { $set: { quantity: newQuantity } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: "Stock changed during this adjustment. Refresh and try again." });
    try {
      await InventoryMovement.create({ item: id, type, quantity, previousQuantity, newQuantity, reason, reference: reference || undefined, performedBy: req.user._id });
    } catch (error) {
      await InventoryItem.updateOne({ _id: id, quantity: newQuantity }, { $set: { quantity: previousQuantity } });
      throw error;
    }
    return res.status(201).json({ item: updated, movement: { type, quantity, previousQuantity, newQuantity, reason } });
  } catch (error) { return next(error); }
}

export async function listInventoryMovements(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "A valid inventory item ID is required" });
    const movements = await InventoryMovement.find({ item: id }).populate("performedBy", "name email").sort({ createdAt: -1 }).limit(100).lean();
    return res.json(movements);
  } catch (error) { return next(error); }
}
