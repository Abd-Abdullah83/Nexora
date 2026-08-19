// app/api/admin/escrow/queue/route.ts
//
// Phase 7 — admin oversight listing of escrow holds, for the doc's
// "Admin: escrow oversight view listing all holds, their state."

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { getEscrowQueue } from "@/lib/wallet/escrow.service";
import { escrowQueueQuerySchema } from "@/lib/validation/escrow";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = escrowQueueQuerySchema.safeParse(params);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.flatten());

    const queue = await getEscrowQueue(parsed.data);

    return Response.json(queue);
  } catch (error) {
    return errorResponse(error);
  }
}
