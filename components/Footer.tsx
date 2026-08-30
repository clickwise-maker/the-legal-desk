import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-primary-100 bg-white">
      <div className="container-legal py-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-legal-muted">
              The unified legal-tech platform. Book lawyers, manage cases, and
              fill forms with AI — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <h4 className="font-heading text-sm font-bold text-primary-800">Platform</h4>
              <ul className="mt-3 space-y-2 text-sm text-legal-muted">
                <li><Link className="hover:text-gold-500" href="/lawyers">Find Lawyers</Link></li>
                <li><Link className="hover:text-gold-500" href="/forms">Fill Forms</Link></li>
                <li><Link className="hover:text-gold-500" href="/pricing">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading text-sm font-bold text-primary-800">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-legal-muted">
                <li><Link className="hover:text-gold-500" href="/terms-of-service">Terms of Service</Link></li>
                <li><Link className="hover:text-gold-500" href="/privacy-policy">Privacy Policy</Link></li>
                <li><Link className="hover:text-gold-500" href="/refund-policy">Refund Policy</Link></li>
                <li><Link className="hover:text-gold-500" href="/cookie-policy">Cookie Policy</Link></li>
                <li><Link className="hover:text-gold-500" href="/disclaimer">Disclaimer</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading text-sm font-bold text-primary-800">Support</h4>
              <ul className="mt-3 space-y-2 text-sm text-legal-muted">
                <li><a className="hover:text-gold-500" href="mailto:hello@legalflow.example">Contact</a></li>
                <li><a className="hover:text-gold-500" href="#">Help Center</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-primary-100 pt-6 text-xs text-legal-muted sm:flex-row">
          <p>© {new Date().getFullYear()} LegalFlow. All rights reserved.</p>
          <p>Not affiliated with any court or bar council. For general assistance.</p>
        </div>
      </div>
    </footer>
  );
}
