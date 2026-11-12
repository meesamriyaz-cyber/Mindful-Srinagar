import { Invoice } from "../models/Invoice.js";
import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { ProgressNote } from "../models/ProgressNote.js";
import { getInvoiceAppointmentIds, validateInvoiceAppointmentItems } from "../security/invoiceSessionRules.js";
import { isValidObjectId, sanitizePayload } from "../utils/query.js";

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return "Provide between 1 and 50 invoice items";
  for (const item of items) {
    if (!item || typeof item.description !== "string" || !item.description.trim() || item.description.trim().length > 200) {
      return "Each invoice item needs a description of 1 to 200 characters";
    }
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    const rate = Number(item.rate);
    if (item.appointment && !isValidObjectId(item.appointment)) return "Each linked session must reference a valid appointment";
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isFinite(rate) || rate < 0 || rate > 100000000) {
      return "Invoice quantities and rates must be valid non-negative amounts";
    }
  }
  return null;
}

export function makeValidateInvoiceAppointmentLinks({
  AppointmentModel = Appointment,
  ProgressNoteModel = ProgressNote,
  InvoiceModel = Invoice
} = {}) {
  return async function validateInvoiceAppointmentLinks(patientId, items, excludeInvoiceId = null) {
    const inputError = validateInvoiceAppointmentItems(items);
    if (inputError) return inputError;
    const appointmentIds = getInvoiceAppointmentIds(items);
    if (!appointmentIds.length) return null;

    const appointments = await AppointmentModel.find({ _id: { $in: appointmentIds } }).select("patient status").lean();
    if (appointments.length !== appointmentIds.length) return "One or more linked appointments could not be found";
    for (const appointment of appointments) {
      if (String(appointment.patient) !== String(patientId)) return "Every billed appointment must belong to the invoice patient";
      if (appointment.status !== "completed") return "Only completed appointments can be billed";
    }

    const notedAppointments = await ProgressNoteModel.distinct("appointment", {
      appointment: { $in: appointmentIds },
      noteType: "session"
    });
    const notedIds = new Set(notedAppointments.map(String));
    if (appointmentIds.some((id) => !notedIds.has(id))) return "A completed session note is required before its appointment can be billed";

    const existingInvoiceFilter = {
      status: { $ne: "void" },
      "items.appointment": { $in: appointmentIds }
    };
    if (excludeInvoiceId) existingInvoiceFilter._id = { $ne: excludeInvoiceId };
    const alreadyBilled = await InvoiceModel.exists(existingInvoiceFilter);
    if (alreadyBilled) return "One or more appointments have already been billed";
    return null;
  };
}

export const validateInvoiceAppointmentLinks = makeValidateInvoiceAppointmentLinks();

function createInvoiceNumber() {
  return "INV-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
}

function normalizeItems(items) {
  return items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity === undefined ? 1 : Number(item.quantity),
    rate: Number(item.rate),
    ...(item.appointment ? { appointment: item.appointment } : {})
  }));
}

export async function createInvoice(req, res, next) {
  try {
    const payload = sanitizePayload(req.body, ["patient", "items", "discount", "paymentMode", "status"]);
    if (payload.status && payload.status !== "draft") return res.status(400).json({ message: "New invoices must start in draft status" });
    if (!isValidObjectId(payload.patient) || !(await Patient.exists({ _id: payload.patient }))) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const itemError = validateItems(payload.items);
    if (itemError) return res.status(400).json({ message: itemError });
    const appointmentError = await validateInvoiceAppointmentLinks(payload.patient, payload.items);
    if (appointmentError) return res.status(409).json({ message: appointmentError });
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
    if (error?.code === 11000) return res.status(409).json({ message: "This appointment has already been billed" });
    return next(error);
  }
}

export async function generateInvoiceFromAppointment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: "A valid appointment ID is required" });
    const appointment = await Appointment.findById(req.params.appointmentId).populate("patient", "fullName mrn");
    if (!appointment || !appointment.patient) return res.status(404).json({ message: "Appointment or linked patient not found" });
    if (appointment.status !== "completed") return res.status(409).json({ message: "Only completed appointments can be invoiced" });
    const itemError = validateItems(req.body?.items);
    if (itemError) return res.status(400).json({ message: itemError });
    const linkedItems = req.body.items.map((item) => ({ ...item, appointment: appointment._id }));
    const appointmentError = await validateInvoiceAppointmentLinks(appointment.patient._id, linkedItems);
    if (appointmentError) return res.status(409).json({ message: appointmentError });
    const invoice = await Invoice.create({
      patient: appointment.patient._id,
      invoiceNo: createInvoiceNumber(),
      items: normalizeItems(linkedItems),
      status: "draft"
    });
    return res.status(201).json(await Invoice.findById(invoice._id).populate("patient", "fullName mrn"));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "This appointment has already been billed" });
    return next(error);
  }
}
