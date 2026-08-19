import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { generateTotpSecret, generateTotpQrCode } from "@/lib/auth/totp";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      throw new AppError("AUTH_2FA_REQUIRED");
    }

    const secret = generateTotpSecret();
    const qrCodeDataUrl = await generateTotpQrCode(session.email, secret);

    // Store the secret now, but two_factor_enabled stays false until
    // the admin successfully verifies a code from their authenticator app.
    await prisma.user.update({
      where: { id: session.userId },
      data: { twoFactorSecret: secret },
    });

    return Response.json({ qrCodeDataUrl, secret });
  } catch (error) {
    return errorResponse(error);
  }
}
