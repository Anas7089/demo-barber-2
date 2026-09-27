# demo-barber2 — booking foundation, analytics, Excel and walk-in sales

This project is the evolving custom-code barbershop platform from the original brief. It includes the Stage 1 booking data model, production-oriented admin analytics/XLSX reporting, and a staff-facing walk-in/manual-sale workflow for customers who arrive without an online appointment.

## What is included

### Platform foundation

- Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS
- Locale-first public routes (`/de`, `/en`)
- PostgreSQL + Prisma data model for services, barbers, schedules, exceptions, customers, bookings, waitlist, settings, expenses and manual sales
- Database-level PostgreSQL exclusion constraint preventing overlapping live appointments for the same barber
- UTC timestamp storage with shop-local timezone display
- Checked-in production migrations under `prisma/migrations/`

### Staff walk-in / manual sale flow

Use `/staff` when a customer receives a service without making an online appointment.

A manual sale records:

- barber who performed the work
- one or more configured services
- optional custom/other work
- actual amount paid (optional override of normal service prices)
- date and time of the work
- payment method: cash, card, bank transfer, mobile payment or other
- optional customer name, email and phone
- optional note
- service direct-cost snapshots
- barber commission snapshot
- staff user who entered the transaction

Manual sales **do not create fake calendar appointments**. They are separate financial/operational records, but they feed into the same revenue, profit, service, barber, customer and daily-trend analytics.

If the actual amount paid differs from the normal selected-service total, the recorded revenue is proportionally allocated across the selected service lines so service-level revenue still reconciles to the sale total.

Barber accounts can only record sales against their own linked barber profile. Admin accounts can choose any active barber. Barber accounts can backdate entries by up to seven days; admins are not subject to that correction window. Future-dated walk-in sales are rejected.

### Protected analytics

- Shared staff credentials login at `/admin/login`
- Admin-only analytics dashboard at `/admin`
- Fast counter-entry/manual-sale page at `/staff`
- Admin and barber roles
- 8-hour JWT sessions
- Database-backed 15-minute account lockout after 10 consecutive failed password attempts
- Date filters limited to a maximum 366-day reporting window
- Revenue split between completed appointments, walk-in/manual sales and forfeited deposits
- Gross profit and estimated net profit
- Direct costs, barber commissions and operating expenses
- Average ticket across completed appointments + walk-ins
- Booking/no-show/cancellation metrics
- Walk-in count and revenue
- Revenue + estimated net-profit trend graph
- Revenue-by-service and revenue-by-barber views
- Combined barber contribution table showing appointments + walk-ins
- Highest-value customer table
- Recent manual-sale audit table showing who entered each transaction
- Recent booking table
- Expense entry/deletion
- Service direct-cost and barber-commission configuration

### Excel export

The admin **Download Excel** button creates a server-side `.xlsx` report for the selected date range and requires an admin session.

Workbook sheets:

1. `Summary`
2. `Bookings`
3. `Walk-in Sales`
4. `Services`
5. `Barbers`
6. `Customers`
7. `Expenses`
8. `Daily Trend`

The `Walk-in Sales` sheet includes sale ID, time, customer/contact, barber, work performed, payment method, revenue, direct cost, commission, contribution, staff member/role and note. User-controlled spreadsheet text is sanitized against formula injection.

## Profit model

For management reporting:

`estimated net profit = recognized revenue - direct service cost - barber commission - recorded operating expenses`

Recognized revenue includes:

- full totals for `COMPLETED` online bookings;
- walk-in/manual-sale totals; and
- forfeited deposits on non-completed bookings whose payment status is `FORFEITED`.

Service costs and barber commissions are snapshotted when a booking/manual sale is created, so changing current prices, costs or commission rates does not rewrite historical profitability.

Barber **contribution** is the barber's recognized revenue minus direct service costs and commission. Shop-wide rent, utilities and other operating expenses are not allocated to individual barbers.

This is management analytics, not statutory/tax accounting. Do not record the same barber compensation both as commission and payroll expense or it will be double-counted.

## Fresh local setup

1. Install Node.js 20.9+ and PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `NEXTAUTH_URL`, and a high-entropy `AUTH_SECRET` (32+ characters).
4. Install dependencies:

   ```bash
   npm install
   ```

5. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

6. Apply all checked-in migrations:

   ```bash
   npm run db:deploy
   ```

7. Create an admin:

   ```bash
   npm run admin:create -- admin@example.com 'use-a-long-unique-password'
   ```

8. Create a barber login after the matching `Barber` row exists. The third argument is that barber's slug:

   ```bash
   npm run staff:create -- barber@example.com 'use-a-long-unique-password' barber-slug
   ```

9. Start development:

   ```bash
   npm run dev
   ```

10. Visit `http://localhost:3000/admin/login`.

Admins land on analytics and can click **Add walk-in sale**. Barber users land on `/staff` and can record only their own manual sales.

## Upgrading an earlier Stage 1 / analytics database

If the database predates the checked-in Prisma migration history, back it up first. For the earlier Stage 1 schema, apply the analytics upgrade and then the walk-in upgrade:

```bash
npm run db:analytics-upgrade
npm run db:constraints
npm run db:walkin-upgrade
npm run db:generate
```

For a deployed database, convert these reviewed SQL upgrade files into your normal migration pipeline and test them against a staging backup before production rollout.

Existing historical bookings may have `costCents = 0` and `barberCommissionBps = 0` if they predate the analytics upgrade. Backfill those snapshots if historical profit needs to reflect old cost/commission data.

## Booking-engine integration rule

When the full public booking engine creates a booking, it must snapshot economics in the same database transaction:

- `Booking.barberCommissionBps = selectedBarber.commissionBps`
- each `BookingService.costCents = selectedService.costCents`
- each `BookingService.priceCents = selectedService.priceCents`

The walk-in flow already snapshots these values automatically.

## Production deployment checklist

- Use a managed PostgreSQL provider with backups/PITR.
- Store `AUTH_SECRET`, database credentials and provider keys only in deployment secrets.
- Use named accounts for every admin/barber; never share staff credentials.
- Link every barber account to exactly one barber profile.
- Apply database migrations before routing traffic to a new deployment.
- Configure monitoring/error reporting and database alerts.
- Configure service costs, barber commissions and operating expenses before relying on profit figures.
- Keep customer exports private; reports can contain personal data and should follow GDPR retention/access rules.
- Establish an operational process for correcting mistaken manual sales. The data model preserves the creator audit trail.
- Test exports and analytics with realistic booking + walk-in volume in staging before launch.

## Current scope boundary

The analytics/export/manual-sale portion is production-oriented. The full public booking engine, Stripe deposits, reminders, self-service cancellation/rescheduling, complete service/admin CRUD, consent platform and final legal content remain later stages from the original brief and should not be represented as finished until implemented and integration-tested.

## Placeholder business values

- Shop: **Atelier 27 Barbers**
- Country: **Germany**
- Default language: **German**, with English secondary
- Currency: **EUR**, VAT-inclusive
- Timezone: **Europe/Berlin**
- Cleanup buffer: **5 minutes**
- Minimum notice: **2 hours**
- Advance window: **60 days**
- Deposits: **off by default**

Replace these with the real shop details before launch.
