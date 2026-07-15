export const services = [
  "Psychology & Mental Health Support",
  "Special Education & Individualized Learning Plans",
  "Occupational Therapy",
  "Comprehensive Diagnostic Evaluations",
  "Audiology & Hearing Assessments",
  "Speech-Language Pathology",
  "Physical Therapy",
  "Advanced Rehabilitation Programs",
  "Tailored Vocational Training & Job Placement"
];

export const departments = [
  { name: "Reception", owner: "Front desk", metric: "New registrations, check-ins, reminders" },
  { name: "Clinical", owner: "Doctors & therapists", metric: "Assessments, sessions, progress notes" },
  { name: "Referral Desk", owner: "Coordinator", metric: "Hospitals, schools, NGOs, follow-ups" },
  { name: "Accounts", owner: "Billing team", metric: "Invoices, receipts, dues, day close" },
  { name: "Stores", owner: "Operations", metric: "Therapy supplies, reorder alerts, vendors" },
  { name: "Management", owner: "Admin", metric: "Reports, staff tasks, service performance" }
];

export const referralPipeline = [
  { source: "Hospitals", count: 9, stage: "Contacted", color: "#23a6a0" },
  { source: "Schools", count: 5, stage: "Assessment booked", color: "#31339a" },
  { source: "Walk-ins", count: 4, stage: "New", color: "#f3c14b" },
  { source: "NGOs", count: 3, stage: "Converted", color: "#5d6a77" }
];
