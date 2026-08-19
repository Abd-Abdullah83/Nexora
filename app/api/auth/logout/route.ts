import { NextRequest } from "next/server";
import { getSession, invalidateSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/security/rate-limit";
import { errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await invalidateSession();

    if (session) {
      await logAuditEvent({
        userId: session.userId,
        action: "auth.logout",
        resourceType: "user",
        resourceId: session.userId,
        ipAddress: getClientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
      });
    }

    return Response.json({ message: "Logged out successfully." });
  } catch (error) {
    return errorResponse(error);
  }
}
