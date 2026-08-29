import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

export function withAuth(handler: Handler, roles?: Array<"CLIENT" | "LAWYER" | "ADMIN">): Handler {
  return async (req, res) => {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (roles && !roles.includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return handler(req, res);
  };
}
