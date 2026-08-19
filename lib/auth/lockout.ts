import { prisma } from "@/lib/db/prisma";
import { minutesFromNow, isExpired } from "@/lib/security/tokens";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function isAccountLocked(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });
  if (!user?.lockedUntil) return false;
  if (isExpired(user.lockedUntil)) return false;
  return true;
}

export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true },
  });
  if (!user) return;

  const newCount = user.failedLoginCount + 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: newCount,
      lockedUntil:
        newCount >= MAX_FAILED_ATTEMPTS ? minutesFromNow(LOCKOUT_MINUTES) : null,
    },
  });
}

export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
