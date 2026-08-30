import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { checkRateLimit, rateLimitDefaults } from "@/lib/rateLimiter";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limit login attempts: 5 per 15 min per IP (fail-open)
        try {
          const ip = ((req as unknown as { headers?: Record<string, string> })?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
            (req as unknown as { headers?: Record<string, string> })?.headers?.["x-real-ip"] ||
            "unknown-ip") as string;
          const rlLogin = await checkRateLimit({ headers: { get: (k: string) => (req as unknown as { headers?: Record<string, string> })?.headers?.[k.toLowerCase()] ?? null } } as unknown as import("next/server").NextRequest, {
            keyPrefix: "auth:login",
            max: rateLimitDefaults.login.max,
            windowSec: rateLimitDefaults.login.windowSec,
            identifier: `ip:${ip}`,
          });
          if (!rlLogin.allowed) return null;
        } catch {
          // fail-open
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;

        // Accept either the account password or a valid email OTP code.
        const passwordOk = await compare(credentials.password, user.passwordHash);
        if (!passwordOk) {
          // Rate limit OTP verify: 5 per 15 min per email
          try {
            const ip = ((req as unknown as { headers?: Record<string, string> })?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
              (req as unknown as { headers?: Record<string, string> })?.headers?.["x-real-ip"] ||
              "unknown-ip") as string;
            const rlOtp = await checkRateLimit({ headers: { get: (k: string) => (req as unknown as { headers?: Record<string, string> })?.headers?.[k.toLowerCase()] ?? null } } as unknown as import("next/server").NextRequest, {
              keyPrefix: "otp:verify",
              max: rateLimitDefaults.otpVerify.max,
              windowSec: rateLimitDefaults.otpVerify.windowSec,
              identifier: `email:${credentials.email.toLowerCase()}`,
            });
            if (!rlOtp.allowed) return null;
          } catch {
            // fail-open
          }
          const otp = await verifyOtp(user.email, credentials.password);
          if (!otp.ok) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      if (!token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "CLIENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CLIENT" | "LAWYER" | "ADMIN") ?? "CLIENT";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
