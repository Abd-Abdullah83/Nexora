// app/api/sellers/notifications/route.ts
// GET  — paginated notification list for the current user
// PATCH — mark one or all notifications as read

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications/notifications.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read"), notificationId: z.string().uuid() }),
  z.object({ action: z.literal("mark_all_read") }),
]);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "20"));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const result = await getNotificationsForUser(session.userId, { page, pageSize, unreadOnly });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    if (parsed.data.action === "mark_all_read") {
      await markAllNotificationsRead(session.userId);
      return Response.json({ message: "All notifications marked as read." });
    }

    const updated = await markNotificationRead(parsed.data.notificationId, session.userId);
    if (!updated) {
      return Response.json({ message: "Notification not found or already read." });
    }
    return Response.json({ message: "Notification marked as read." });
  } catch (error) {
    return errorResponse(error);
  }
}
