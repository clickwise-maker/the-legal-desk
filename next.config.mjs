/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// CSP integrations audited 2026-08-30:
// - Next.js: 'self', inline styles (style={{width}} in dashboard, radial-gradient in hero) → style-src 'unsafe-inline'
//   dev needs 'unsafe-eval' for Fast Refresh; prod removes it
// - Razorpay: checkout.razorpay.com + api.razorpay.com (script/frame/connect) — verified in lib/use-payment.ts + lib/payments/razorpay.ts
// - DeepSeek: api.deepseek.com (connect) — lib/ai/deepseek.ts
// - Fonts: localFont ../fonts/* → font-src 'self' data:
// - Images: remotePatterns https:** + localhost, plus blob: data: for piX/uploads, Vercel Blob https:
// - No camera/mic: photo via <input type=file> (profile/onboarding/forms), no getUserMedia found → Permissions-Policy denies both
// - Razorpay iframe allowed via frame-src, but clickjacking blocked via frame-ancestors 'self' + X-Frame-Options SAMEORIGIN

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com https://api.razorpay.com`.trim().replace(/\s+/g, " "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:3000",
  "font-src 'self' data:",
  "connect-src 'self' https://api.deepseek.com https://api.razorpay.com https://checkout.razorpay.com",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
