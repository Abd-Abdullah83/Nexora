// app/api/admin/support/[id]/route.ts
// GET   — fetch ticket + messages
// POST  — admin reply
// PATCH — resolve or assign

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import {
  adminReplyToTicket,
  resolveTicket,
  assignTicket,
} from "@/lib/sellers/support-tickets.service";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";

const replySchema = z.object({ body: z.string().trim().min(2).max(5000) });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("assign"), assignTo: z.string().uuid() }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        seller: { select: { displayName: true, businessEmail: true } },
        assignee: { select: { fullName: true } },
      },
    });
    if (!ticket) throw new AppError("VALIDATION_ERROR", { id: "Ticket not found." });
    return Response.json({ ticket });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    const message = await adminReplyToTicket({
      ticketId: params.id,
      adminUserId: session.userId,
      body: parsed.data.body,
    });
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten().fieldErrors);

    if (parsed.data.action === "resolve") {
      const ticket = await resolveTicket({ ticketId: params.id, adminUserId: session.userId });
      return Response.json({ ticket, message: "Ticket resolved." });
    }

    const ticket = await assignTicket({
      ticketId: params.id,
      assignToAdminUserId: parsed.data.assignTo,
      actorUserId: session.userId,
    });
    return Response.json({ ticket, message: "Ticket assigned." });
  } catch (error) {
    return errorResponse(error);
  }
}
