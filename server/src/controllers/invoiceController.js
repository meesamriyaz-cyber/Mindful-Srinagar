import { Invoice } from "../models/Invoice.js";
import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { isValidObjectId, sanitizePayload } from "../utils/query.js";

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return "Provide between 1 and 50 invoice items";
  for (const item of items) {
    if (!item || typeof item.description !== "string" || !item.description.trim() || item.description.trim().length > 200) {
      return "Each invoice item needs a description of 1 to 200 characters";
    }
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    const rate = Number(item.rate);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isFinite(rate) || rate < 0 || rate > 100000000) {
      return "Invoice quantities and rates must be valid non-negative amounts";
    }
  }
  return null;
}

function createInvoiceNumber() {
  return "INV-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
}

function normalizeItems(items) {
  return items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity === undefined ? 1 : Number(item.quantity),
    rate: Number(item.rate)
  }));
}

export async function createInvoice(req, res, next) {
  try {
    const payload = sanitizePayload(req.body, ["patient", "items", "discount", "paymentMode"]);
    if (!isValidObjectId(payload.patient) || !(await Patient.exists({ _id: payload.patient }))) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const itemError = validateItems(payload.items);
    if (itemError) return res.status(400).json({ message: itemError });
    const discount = payload.discount === undefined ? 0 : Number(payload.discount);
    if (!Number.isFinite(discount) || discount < 0) return res.status(400).json({ message: "Discount must be a valid non-negative amount" });
    const invoice = await Invoice.create({
      patient: payload.patient,
      invoiceNo: createInvoiceNumber(),
      items: normalizeItems(payload.items),
      discount,
      paymentMode: payload.paymentMode || "cash",
      paidAmount: 0,
      status: "draft"
    });
    return res.status(201).json(await Invoice.findById(invoice._id).populate("patient", "fullName mrn"));
  } catch (error) {
    return next(error);
  }
}

export async function generateInvoiceFromAppointment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: "A valid appointment ID is required" });
    const appointment = await Appointment.findById(req.params.appointmentId).populate("patient", "fullName mrn");
    if (!appointment || !appointment.patient) return res.status(404).json({ message: "Appointment or linked patient not found" });
    const itemError = validateItems(req.body?.items);
    if (itemError) return res.status(400).json({ message: itemError });
    const invoice = await Invoice.create({
      patient: appointment.patient._id,
      invoiceNo: createInvoiceNumber(),
      items: normalizeItems(req.body.items),
      status: "draft"
    });
    return res.status(201).json(await Invoice.findById(invoice._id).populate("patient", "fullName mrn"));
  } catch (error) {
    return next(error);
  }
}
