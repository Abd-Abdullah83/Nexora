// app/api/sellers/promotions/[id]/route.ts
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deactivatePromotion } from "@/lib/sellers/promotions.service";
import { AppError, errorResponse } from "@/lib/errors";

async function getActiveSeller(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!seller || seller.status !== "active") throw new AppError("ADMIN_UNAUTHORISED");
  return seller;
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) throw new AppError("AUTH_REQUIRED");
    const seller = await getActiveSeller(session.userId);
    await deactivatePromotion(params.id, seller.id, session.userId);
    return Response.json({ message: "Promotion deactivated." });
  } catch (error) {
    return errorResponse(error);
  }
}
