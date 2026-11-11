import mongoose from "mongoose";
import { Invoice } from "../models/Invoice.js";
import { isValidObjectId } from "../utils/query.js";

const methods = ["cash", "upi", "card", "bank"];

export async function recordInvoicePayment(req, res, next) {
  try {
    const { id } = req.params;
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || "").trim();
    const reference = String(req.body?.reference || "").trim().slice(0, 120);
    const notes = String(req.body?.notes || "").trim().slice(0, 500);
    if (!isValidObjectId(id)) return res.status(400).json({ message: "A valid invoice ID is required" });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return res.status(400).json({ message: "Payment amount must be greater than zero" });
    if (!methods.includes(method)) return res.status(400).json({ message: "Choose a valid payment method" });

    const invoice = await Invoice.findById(id).select("items discount paidAmount status");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "void") return res.status(409).json({ message: "Payments cannot be recorded against a void invoice" });
    const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const total = subtotal - invoice.discount;
    const outstanding = Math.max(total - invoice.paidAmount, 0);
    if (amount > outstanding + 0.000001) return res.status(409).json({ message: "Payment exceeds the outstanding invoice balance" });

    const paidAmount = Math.round((invoice.paidAmount + amount) * 100) / 100;
    const status = paidAmount >= total - 0.000001 ? "paid" : "partial";
    const payment = {
      _id: new mongoose.Types.ObjectId(),
      amount,
      method,
      reference: reference || undefined,
      notes: notes || undefined,
      receivedBy: req.user._id,
      receivedAt: new Date()
    };
    const updated = await Invoice.findOneAndUpdate(
      { _id: id, paidAmount: invoice.paidAmount, status: { $ne: "void" } },
      { $set: { paidAmount, status }, $push: { payments: payment }, $setOnInsert: {} },
      { new: true, runValidators: true }
    ).populate("patient", "fullName mrn").populate("payments.receivedBy", "name email");
    if (!updated) return res.status(409).json({ message: "Invoice changed while recording payment. Refresh and try again." });
    return res.status(201).json(updated);
  } catch (error) { return next(error); }
}
