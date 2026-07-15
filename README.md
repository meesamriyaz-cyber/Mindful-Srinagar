# Mindful Centre Srinagar MERN Platform

Responsive public website and MERN operations platform for **Mindful Centre for Rehabilitation Research & Trainings**, Srinagar.

The build is designed for day-to-day centre activity:

- Patient registration, MRN tracking, guardian/contact details and care status
- Doctors, therapists and discipline-wise availability
- Hospital, doctor, school, NGO, walk-in and online referral tracking
- Appointments, rooms, check-in status and clinical notes
- Billing, invoices, payment status and day-close visibility
- Inventory and low-stock alerts for therapy/clinical supplies
- Staff tasks, follow-ups, director analytics and management dashboard metrics

## Tech Stack

- Client: React + Vite + CSS
- Server: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT staff login with role-aware middleware

## Project Structure

```text
client/   React website and staff console UI
server/   Express API, Mongo models, routes, seed data
```

## Run Locally

1. Install dependencies:

```bash
npm run install:all
```

2. Copy server environment file:

```bash
cp server/.env.example server/.env
```

3. Optionally copy the client environment file if the API is not on `http://localhost:5000/api`:

```bash
cp client/.env.example client/.env
```

4. Start MongoDB locally, then seed demo data for local development:

```bash
npm run seed
```

5. Start both client and API:

```bash
npm run dev
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:5000`.

Use a seeded or production staff account to open the Staff Console. Accounts with `director` or `admin` role see the whole-centre director view with revenue, collections, outstanding dues, referral conversion, service demand and operational risks.

## Main API Routes

All operational routes require a Bearer token. Public website enquiries can create a referral lead without exposing protected records.

```text
GET    /api/health
POST   /api/auth/login
POST   /api/enquiries
GET    /api/dashboard
CRUD   /api/patients
CRUD   /api/doctors
CRUD   /api/referrals
CRUD   /api/appointments
CRUD   /api/invoices
CRUD   /api/inventory
CRUD   /api/tasks
```

## Business Profile Details Used

- Centre: Mindful Centre for Rehabilitation Research & Trainings for Persons with Disabilities
- Services: psychology, special education, occupational therapy, diagnostics, audiology, speech-language pathology, physical therapy, rehabilitation programs, vocational training
- Phone/WhatsApp: `(+91) 9906897822`
- Email: `mrcsgr2025@gmail.com`
- Address: Owaisabad Gousia Colony Bemina Srinagar-UT J&K-190018
