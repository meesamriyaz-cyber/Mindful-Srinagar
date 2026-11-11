import mongoose from "mongoose";
import { Invoice } from "../models/Invoice.js";
import { isValidObjectId } from "../utils/query.js";

const methods = ["cash", "upi", "card", "bank"];
const toCents = (value) => Math.round(value * 100);

export async function recordInvoicePayment(req, res, next) {
  try {
    const { id } = req.params;
    const rawAmount = req.body?.amount;
    const amount = Number(rawAmount);
    const method = String(req.body?.method || "").trim();
    const reference = String(req.body?.reference || "").trim().slice(0, 120);
    const notes = String(req.body?.notes || "").trim().slice(0, 500);
    if (!isValidObjectId(id)) return res.status(400).json({ message: "A valid invoice ID is required" });
    if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === "" || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !Number.isInteger(amount * 100)) {
      return res.status(400).json({ message: "Payment amount must be positive and have at most two decimal places" });
    }
    if (!methods.includes(method)) return res.status(400).json({ message: "Choose a valid payment method" });

    const invoice = await Invoice.findById(id).select("items discount paidAmount status payments");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "void") return res.status(409).json({ message: "Payments cannot be recorded against a void invoice" });
    const subtotalCents = invoice.items.reduce((sum, item) => sum + toCents(item.quantity * item.rate), 0);
    const totalCents = subtotalCents - toCents(Number(invoice.discount || 0));
    const priorPaidCents = toCents(Number(invoice.paidAmount || 0));
    const amountCents = toCents(amount);
    const outstandingCents = totalCents - priorPaidCents;
    if (outstandingCents <= 0 || amountCents > outstandingCents) return res.status(409).json({ message: "Payment exceeds the outstanding invoice balance" });

    const paidAmount = (priorPaidCents + amountCents) / 100;
    const status = paidAmount === totalCents / 100 ? "paid" : "partial";
    const priorMethods = new Set((invoice.payments || []).map((entry) => entry.method));
    const paymentMode = priorMethods.size === 0 ? method : priorMethods.size === 1 && priorMethods.has(method) ? method : "mixed";
    const payment = {
      _id: new mongoose.Types.ObjectId(),
      amount: amountCents / 100,
      method,
      reference: reference || undefined,
      notes: notes || undefined,
      receivedBy: req.user._id,
      receivedAt: new Date()
    };
    const updated = await Invoice.findOneAndUpdate(
      { _id: id, paidAmount: invoice.paidAmount, status: { $ne: "void" } },
      { $set: { paidAmount, status, paymentMode }, $push: { payments: payment } },
      { new: true, runValidators: true }
    ).populate("patient", "fullName mrn").populate("payments.receivedBy", "name email");
    if (!updated) return res.status(409).json({ message: "Invoice changed while recording payment. Refresh and try again." });
    return res.status(201).json(updated);
  } catch (error) { return next(error); }
}
