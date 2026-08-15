import { Invoice } from "../models/Invoice.js";
import { Appointment } from "../models/Appointment.js";

export async function generateInvoiceFromAppointment(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate("patient", "fullName mrn")
      .populate("practitioner", "name");
    if (!appointment) {
      res.status(404);
      throw new Error("Appointment not found");
    }

    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("At least one invoice item is required");
    }

    const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoice = await Invoice.create({
      patient: appointment.patient._id,
      invoiceNo,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate
      })),
      status: "draft"
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("patient", "fullName mrn");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}
