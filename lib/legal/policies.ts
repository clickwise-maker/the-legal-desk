export const LEGAL_POLICY_VERSION = "1.0";
export const LEGAL_POLICY_LAST_UPDATED = "2026-08-30";

export type PolicySection = { heading: string; body: string[] };

export const PRIVACY_POLICY = {
  title: "Privacy Policy",
  version: LEGAL_POLICY_VERSION,
  lastUpdated: LEGAL_POLICY_LAST_UPDATED,
  intro: "LegalFlow is a technology platform, not a law firm. This Privacy Policy explains what we collect, why, and your rights. For general context on Indian data protection, see the Digital Personal Data Protection Act, 2023 (DPDP Act) — we do not claim certification under it.",
  sections: [
    {
      heading: "Information We Collect",
      body: [
        "Account: name, email, phone (verified, unique), password hash, role (Client/Lawyer/Admin).",
        "Profile: address, city/state/country/pincode, date of birth, occupation, company, professional details, education, family, identity documents, financial details (all optional, stored per your consent).",
        "Documents & uploads: files you upload (PDF/PNG/JPEG/WEBP), OCR text, field values, and derived chunks/citations for Copilot search.",
        "Payment metadata: Razorpay order/payment IDs, wallet balance/currency, transaction type/amount/status/reference — we do not store full card/UPI credentials.",
        "Usage: bookings, forms, legal problems, lawyer responses, copilot messages, subscription period, device IP and user-agent for security.",
      ],
    },
    {
      heading: "Purpose",
      body: [
        "Provide lawyer discovery, scheduling, form autofill, Copilot search/drafting, and wallet/subscription billing.",
        "Verify lawyers, prevent fraud/abuse, and enforce free-plan limits.",
        "Comply with law and resolve disputes or grievances.",
      ],
    },
    {
      heading: "Documents & Uploads",
      body: [
        "Files are treated as untrusted input, validated by MIME and magic bytes, scanned for malicious content, and stored via Vercel Blob or local `.uploads` outside the web root.",
        "Access requires authentication and ownership checks; direct file URLs are not public.",
        "We do not execute uploaded content as code.",
      ],
    },
    {
      heading: "Retention",
      body: [
        "Account and profile data retained while your account is active and for a reasonable period thereafter for legal/accounting purposes.",
        "Documents and forms retained until you delete them or your account is closed, subject to legal holds.",
        "Payment metadata and transaction ledgers retained as required by law and for audit.",
        "OTP codes expire in 10 minutes, are single-use, and are hashed at rest.",
      ],
    },
    {
      heading: "Your Rights & Consent",
      body: [
        "Access, correct, or delete your profile and documents via Dashboard/Profile or by contacting grievance.",
        "Withdraw consent for optional data (profile sections) — withdrawing may limit form autofill quality.",
        "First-visit legal consent is stored server-side with your user ID, policy version, and timestamp; you will be asked again if the policy version changes.",
        "For DPDP Act context, you may exercise rights as described under that Act with the relevant authorities; this policy does not replace independent legal advice.",
      ],
    },
    {
      heading: "Grievance Contact",
      body: [
        "Grievance Officer: LegalFlow Grievance Team",
        "Email: grievance@legalflow.example",
        "Address: LegalFlow, Bengaluru, Karnataka, India",
        "We aim to acknowledge within 48 hours and resolve per applicable law.",
      ],
    },
  ] as PolicySection[],
};

export const TERMS_POLICY = {
  title: "Terms of Service",
  version: LEGAL_POLICY_VERSION,
  lastUpdated: LEGAL_POLICY_LAST_UPDATED,
  intro: "By using LegalFlow you agree to these Terms. LegalFlow is a technology platform that connects independent lawyers and clients and provides document tools; it is not a law firm and does not provide legal advice.",
  sections: [
    {
      heading: "No Law Firm / No Automatic Advocate-Client Relationship",
      body: [
        "LegalFlow does not create an advocate-client relationship automatically by browsing, posting a problem, or using Copilot.",
        "A relationship is created only when you and a lawyer mutually agree to engage after direct communication.",
        "Copilot and FormPilot outputs are informational and must be reviewed by a qualified lawyer before you act.",
      ],
    },
    {
      heading: "Eligibility & Accounts",
      body: [
        "You must be 18+ and provide accurate information. One verified email and one verified phone per account; duplicates are blocked by unique constraints.",
        "You are responsible for your password and for activities under your account.",
      ],
    },
    {
      heading: "User & Lawyer Responsibilities",
      body: [
        "Users: do not submit false or unlawful content; respect lawyer availability; do not attempt to bypass limits or payments.",
        "Lawyers: provide accurate bar/licence information, maintain availability, respond professionally, and comply with Bar Council rules.",
        "Verification is currently manual/queue-based; LegalFlow does not guarantee lawyer licensing beyond displayed verification status.",
      ],
    },
    {
      heading: "Payments & Fees",
      body: [
        "Consultations: lawyer rates + 12% platform commission, escrow via Razorpay, wallet payouts; refunds per Refund Policy.",
        "FormPilot: India ₹5 per completed form, International $1 per completed form — deducted atomically from your wallet only after successful completion, with duplicate protection.",
        "Subscriptions: FREE 10 clients/month, PRO 100 clients/month (monthly/yearly) — prices set server-side by your location (city→state→India→International), never from client input.",
      ],
    },
    {
      heading: "Content & Conduct",
      body: [
        "You retain ownership of your uploads; you grant LegalFlow a licence to process them for the services you request.",
        "Do not upload malicious files, attempt path traversal, or execute code via uploads.",
        "We may moderate or remove content that violates law or these Terms.",
      ],
    },
    {
      heading: "Disclaimers & Limitation",
      body: [
        "Services are provided on an 'as is' basis; we do not warrant that Copilot is error-free or that a lawyer will respond.",
        "To the extent permitted by law, LegalFlow's liability is limited to the fees you paid for the relevant service.",
      ],
    },
  ] as PolicySection[],
};

export const REFUND_POLICY = {
  title: "Refund & Cancellation Policy",
  version: LEGAL_POLICY_VERSION,
  lastUpdated: LEGAL_POLICY_LAST_UPDATED,
  intro: "Refunds and cancellations follow the existing Razorpay and wallet architecture. We do not change payment percentages in this policy.",
  sections: [
    {
      heading: "Consultation Bookings",
      body: [
        "Pending bookings: you may cancel before the lawyer confirms — wallet-paid bookings are refunded to your wallet, Razorpay-paid bookings are refunded via Razorpay (if supported) and wallet clawback.",
        "Confirmed/completed bookings: contact the lawyer or grievance for exceptional refunds; completed sessions are generally non-refundable.",
        "No-show: handled per lawyer availability and platform commission rules.",
      ],
    },
    {
      heading: "FormPilot (Auto Form Fill)",
      body: [
        "Charged only when a form reaches COMPLETED after successful fill and your explicit payment — ₹5 (India) or $1 (International) deducted atomically.",
        "Not charged if upload, OCR, AI processing, or PDF generation fails, or if you lack balance or are unauthorized, or if the form was already paid (409).",
        "Duplicate charges are prevented via paymentRef and FORM_PAYMENT reference checks; concurrent requests are guarded by atomic wallet update.",
      ],
    },
    {
      heading: "Subscriptions",
      body: [
        "Upgrade via Razorpay order + server verification only — never from client-provided price; period starts on verified payment.",
        "Cancellation: mark CANCELED, benefits remain until periodEnd, then revert to FREE 10 clients/month.",
        "No prorated refund for mid-period cancellation unless required by law or Razorpay refund is initiated.",
      ],
    },
    {
      heading: "Wallet Deposits",
      body: [
        "Deposits via Razorpay: pending transaction created, then on verified payment wallet balance increments atomically and transaction marked SUCCESS.",
        "Withdrawals: minimum ₹50 / $10 per WalletCard, processed via existing wallet/withdraw flow.",
        "All amounts and currencies are recorded in the transaction ledger (e.g., -₹5 / -$1, +₹100).",
      ],
    },
    {
      heading: "How to Request",
      body: [
        "Contact grievance@legalflow.example with payment/booking/form ID, reason, and supporting details. We aim to respond within 5 business days.",
        "Razorpay refunds, where applicable, are issued to the original payment method and may take 5–7 business days to reflect.",
      ],
    },
  ] as PolicySection[],
};

export const COOKIE_POLICY = {
  title: "Cookie Policy",
  version: LEGAL_POLICY_VERSION,
  lastUpdated: LEGAL_POLICY_LAST_UPDATED,
  intro: "We use cookies and similar storage for essential operation, security, and preferences. We do not claim certifications beyond what is described here.",
  sections: [
    {
      heading: "What We Use",
      body: [
        "Essential: NextAuth session JWT (30 days), CSRF protection, and consent flag for the legal disclaimer (server consent is authoritative, localStorage is a fast mirror).",
        "Functional: theme, language, and draft autosave in localStorage.",
        "Analytics: not enabled by default; if added, we will update this policy and ask for consent where required.",
      ],
    },
    {
      heading: "Your Choices",
      body: [
        "You can block cookies in your browser, but essential cookies are required to sign in, book, or fill forms.",
        "Clearing cookies will sign you out and may re-show the legal disclaimer.",
      ],
    },
    {
      heading: "Retention",
      body: [
        "Session cookie: 30 days or until sign-out.",
        "Consent record: server-side `LegalConsent` with version and timestamp, retained while your account is active.",
      ],
    },
  ] as PolicySection[],
};

export const DISCLAIMER_POLICY = {
  title: "Disclaimer",
  version: LEGAL_POLICY_VERSION,
  lastUpdated: LEGAL_POLICY_LAST_UPDATED,
  intro: "This Disclaimer must be read together with the Terms of Service and Privacy Policy. It does not replace legal advice from a qualified advocate.",
  sections: [
    {
      heading: "Platform, Not Law Firm",
      body: [
        "LegalFlow is a technology platform. We do not practice law, do not act as your lawyer, and do not guarantee outcomes.",
        "No advocate-client relationship is formed with LegalFlow itself, even if you post a problem or use Copilot.",
      ],
    },
    {
      heading: "AI & Information Only",
      body: [
        "Copilot, FormPilot, and related AI outputs are informational, may be incomplete, and must be reviewed by a licensed lawyer before you rely on them.",
        "We cite sources where possible (hybrid search), but you remain responsible for verifying citations and jurisdiction.",
      ],
    },
    {
      heading: "Jurisdiction",
      body: [
        "Laws vary by city, state, and country; pricing and lawyer matching use your profile location (city→state→India→International) server-side.",
        "For DPDP Act 2023 and other Indian law references, we provide general information only and do not claim compliance certification.",
      ],
    },
  ] as PolicySection[],
};
