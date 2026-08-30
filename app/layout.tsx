import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Copilot } from "@/components/Copilot";
import { LegalDisclaimerModal } from "@/components/LegalDisclaimerModal";

const merriweather = localFont({
  src: "../fonts/merriweather-latin.woff2",
  variable: "--font-merriweather",
  display: "swap",
});

const inter = localFont({
  src: "../fonts/inter-var-latin.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LegalFlow — Book Lawyers, Fill Forms with AI",
    template: "%s | LegalFlow",
  },
  description:
    "LegalFlow combines lawyer booking, a legal marketplace, and AI-powered form filling in one platform.",
  keywords: ["legal", "lawyer", "booking", "form filling", "AI", "legaltech", "India"],
  openGraph: {
    title: "LegalFlow",
    description: "Book lawyers, fill forms with AI — one legal-tech platform.",
    type: "website",
  },
  icons: {
    icon: "/logo-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${merriweather.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Copilot />
        <LegalDisclaimerModal />
      </body>
    </html>
  );
}
