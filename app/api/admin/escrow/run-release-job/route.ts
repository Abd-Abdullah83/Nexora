// app/api/admin/escrow/run-release-job/route.ts
//
// Not in the doc's literal API contract (it lists "ReleaseEscrowJob
// (scheduled job, not a public endpoint)") — but per the doc's own Risk
// note: "given team size, consider keeping the scheduled release job's
// first version manually triggered by an Admin button rather than fully
// automatic, until you trust it with real data." There is also no job
// scheduler/cron anywhere in this codebase to run a real scheduled job
// on. This route IS that manual trigger — an admin-only button, rate
// limited so it can't be hammered, every run fully audit-logged via
// runEscrowReleaseJob() itself.
//
// Wiring this to a real daily cron later (e.g. a hosting platform's
// scheduled-functions feature) is a deployment-infra change, not a logic
// change — it would call this same route (or runEscrowReleaseJob()
// directly) on a timer instead of a click.

import { requireAdmin } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/security/rate-limit";
import { runEscrowReleaseJob } from "@/lib/wallet/escrow.service";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST() {
  try {
    const session = await requireAdmin();
    if (!session) throw new AppError("ADMIN_UNAUTHORISED");

    // Rate limited per-admin, not because this is dangerous to call
    // often (it's fully idempotent — see ledger.service.ts), but because
    // each run does a real database scan + N transactions, and there's
    // no reason for it to be clickable faster than, say, once a minute.
    const { allowed } = await rateLimit(`admin-escrow-release:${session.userId}`, 5, 60);
    if (!allowed) {
      throw new AppError("RATE_LIMIT_EXCEEDED", {
        message: "Please wait before running the release job again.",
      });
    }

    const result = await runEscrowReleaseJob(session.userId);

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
