# LegalFlow

The unified legal-tech platform: **book lawyers**, **fill forms with AI**, and
manage everything from **one dashboard** — merged from Cal.com-style
scheduling, a lawyer marketplace, and an AI form-filling tool.

## Features

- **Scheduling core (Cal.com-style)** — weekly availability, slot expansion,
  conflict-free booking with 60-minute consultations.
- **Lawyer marketplace** — profiles, specializations, verified badges,
  ratings/reviews, 12% platform commission.
- **AI form filling (FormPilot)** — upload PDF/PNG/JPEG/WEBP → Tesseract OCR →
  DeepSeek field detection → auto-fill → editable review → downloadable filled
  PDF at ₹5/form.
- **Unified dashboard** — bookings, forms, cases, wallet balance and
  transaction history in one place.
- **Payments** — Razorpay checkout for bookings, form fills and wallet
  deposits; wallet payouts for lawyers; commissions deducted automatically.
- **Roles** — `CLIENT`, `LAWYER`, `ADMIN`.

## Tech stack

Next.js 14 · Tailwind CSS · Prisma · PostgreSQL · NextAuth.js · Razorpay ·
DeepSeek API · Tesseract OCR · Vercel Blob · pdf-lib · poppler-utils

## Getting started

### 1. Local development (docker-compose)

```bash
# Start PostgreSQL
docker compose up -d db

# Configure environment
cp .env.example .env
# ... fill in RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, DEEPSEEK_API_KEY

# Install, migrate, seed
npm install
npm run db:push
npm run db:seed

# Run
npm run dev
# http://localhost:3000
```

### 2. Without Docker (plain local PostgreSQL)

```bash
createdb legalflow
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

### 3. Production (docker-compose full stack)

```bash
docker compose up --build
# app on :3000, postgres on :5432
```

## Demo accounts (from seed)

All use password `password123`.

| Role    | Email                        |
| ------- | ---------------------------- |
| Client  | client@legalflow.example     |
| Lawyer  | meera@legalflow.example      |
| Lawyer  | rahul@legalflow.example      |
| Admin   | admin@legalflow.example      |

## Environment variables

See `.env.example`. Key variables:

| Variable                     | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection string            |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth config                    |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server-side Razorpay         |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client-side Razorpay key                |
| `DEEPSEEK_API_KEY`           | DeepSeek for field detection/filling    |
| `BLOB_READ_WRITE_TOKEN`      | Vercel Blob (falls back to local `.uploads`) |

Without Razorpay keys the app runs in **test mode**: payments are simulated so
you can exercise the full flow. Without a DeepSeek key, form field detection
falls back to a heuristic so the OCR→fields pipeline still works.

## Workflow

1. Sign up (client or lawyer)
2. Dashboard → Book a lawyer **or** Upload a form
3. Form upload → AI runs OCR → fields are detected and pre-filled
4. Review/edit fields → pay ₹5 → download filled PDF
5. Share the filled form with a lawyer during a booked consultation

## Deployment

- **Vercel**: push the repo, configure env vars, run `prisma db push` on a
  managed Postgres, and enable Vercel Blob.
- **Docker**: `docker compose up --build` (see `docker/Dockerfile`).

## Project structure

```
app/            Next.js pages + API routes (App Router)
components/     UI components (Navbar, LawyersList, FormsList, …)
lib/            prisma, auth, scheduling, payments, ai, ocr, storage, pdf
prisma/         schema + seed
public/         static assets
docker/         production Dockerfile
```

## Notes

- All Cal.com branding has been removed; the package is `legalflow`.
- The Cal.com-style scheduling engine lives in `lib/scheduling.ts` and powers
  every booking slot across the app.
- Commissions (12%) are deducted automatically and recorded as
  `COMMISSION` transactions on the lawyer's wallet.
