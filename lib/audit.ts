import { prisma } from "@/lib/db/prisma";

interface LogParams {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress: string;
  userAgent?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}

export async function logAuditEvent(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent ?? undefined,
        oldValues: params.oldValues as object | undefined,
        newValues: params.newValues as object | undefined,
      },
    });
  } catch {
    // Audit logging must never break the main request flow.
  }
}
