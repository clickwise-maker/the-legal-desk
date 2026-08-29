import "next-auth/jwt";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CLIENT" | "LAWYER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "CLIENT" | "LAWYER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "CLIENT" | "LAWYER" | "ADMIN";
  }
}
