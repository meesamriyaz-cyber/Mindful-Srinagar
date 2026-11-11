# Mindful Centre — Release Readiness Runbook

This runbook is an operational checklist, not a declaration that production has been approved. Complete it against the actual staging/production infrastructure and record evidence before go-live.

## 1. Environment and deployment preflight

The API validates its runtime configuration at startup. Production requires:

- `NODE_ENV=production`
- `MONGO_URI` using `mongodb://` or `mongodb+srv://`
- `JWT_SECRET` containing a unique secret of at least 32 characters (never use the example value)
- `CLIENT_ORIGIN` containing comma-separated, origin-only public HTTPS frontend origins
- A MongoDB replica set or sharded cluster: inventory movements and clinical amendments use transactions

Do not commit `.env` files, credentials, database URIs, backup archives, or real patient data. Store secrets in the hosting provider's secret/environment-variable facility. Restrict database network access and database-user privileges to the application and authorised operators.

The frontend build uses `VITE_API_URL`. Set it to the exact API base URL ending in `/api`; Vite variables are public and must never contain secrets.

## 2. Release smoke checks

Run against staging first, using a dedicated, least-privilege test account. Execute once for each role so the full permission matrix is exercised:

```bash
RELEASE_BASE_URL=https://staging.example.org \
RELEASE_TEST_EMAIL=release-test@example.org \
RELEASE_TEST_PASSWORD='use-a-secret-from-your-password-manager' \
RELEASE_TEST_ROLE=reception \
npm run release:smoke --prefix server
```

Supported roles: `director`, `admin`, `reception`, `doctor`, `therapist`, `accounts`, `coordinator`.

The smoke script performs read-only health, login, allowed-route and forbidden-route checks. It does not create, edit, or delete records. Use separate accounts for each role; never grant a test account a higher role merely to make the checks pass.

## 3. Backup and recovery drill

Use MongoDB Database Tools compatible with the deployed MongoDB server. Store archives outside the application host, encrypt them at rest and in transit, restrict access, and define retention with centre management.

Create a compressed archive:

```bash
mongodump --uri "$MONGO_URI" --archive="$BACKUP_FILE" --gzip
```

Before every restore drill:
1. Confirm the archive exists, is non-empty, and its checksum is recorded.
2. Provision a separate, isolated restore-verification database/cluster. Never point a test restore at the live database.
3. Restore into the isolated target using the source and destination namespaces appropriate to the archive:

```bash
mongorestore --uri "$RESTORE_URI" --archive="$BACKUP_FILE" --gzip \
  --nsFrom='mindful_srinagar.*' --nsTo='mindful_restore_verification.*'
```

4. Verify collection counts and representative relationships (patients, appointments, invoices/payments, inventory items/movements, clinical records/amendments, users). Do not print patient-identifying data into CI logs.
5. Start an isolated application instance against the restored database and run the role-based smoke checks.
6. Record backup timestamp, archive checksum, source/target identifiers (no credentials), restore duration, verification results, operator, and any corrective action.

The namespace examples above must be adapted to the actual database name in the deployed `MONGO_URI`. Confirm the restore target before running the command. Do not use `--drop` against production.

A successful `mongodump` alone is not a successful recovery test. A release owner must perform and record a restore drill before production sign-off.

## 4. Centre acceptance checklist

Complete with centre management and designated staff using synthetic or approved test records:

- [ ] Director/admin: staff access, centre dashboard, patient/referral/appointment visibility, billing and inventory permissions.
- [ ] Reception/coordinator: enquiry/referral intake, patient registration, appointment booking and follow-up.
- [ ] Doctor/therapist: assigned patient scope, practitioner dashboard, clinical records, prescription permissions where applicable.
- [ ] Accounts: invoice visibility and payment recording; no unauthorised clinical or patient-management access.
- [ ] Clinical governance: completed records reject ordinary edits; authorised amendments preserve reason, author, timestamp and before/after values.
- [ ] Billing: partial/full payments reconcile; void invoices reject payments; outstanding balances block discharge.
- [ ] Inventory: receipt/issue/adjustment history reconciles with stock; negative stock is rejected.
- [ ] Tasks: role/assignment restrictions and lifecycle transitions behave as approved.
- [ ] Accessibility and usability: desktop/tablet/mobile layouts, keyboard operation, readable validation/error messages.
- [ ] Operational recovery: staff know whom to contact for outage, suspected data exposure, failed backup, and restore requests.

Record test date, tester, role, outcome, defects, retest evidence and centre sign-off. Do not use real patient data for acceptance testing unless explicitly authorised under the centre's data-handling policy.

## 5. Go-live gates

Do not declare release-ready until all are evidenced:

- [ ] GitHub CI passes on the release candidate.
- [ ] Local server tests and client production build pass on the exact release candidate commit.
- [ ] Smoke checks pass for every deployed staff role.
- [ ] MongoDB transaction support is confirmed.
- [ ] Backup archive and isolated restore drill are verified.
- [ ] Production secrets/origins/database access are reviewed.
- [ ] Centre acceptance checklist is signed and blocking defects are resolved.
- [ ] Rollback owner, deployment version, and recovery contacts are recorded.

This repository cannot verify provider-side secrets, live database topology, real backups, or centre sign-off from GitHub CI. Those checks require authorised access to the actual deployment and centre environment.
