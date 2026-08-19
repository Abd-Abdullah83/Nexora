// ─────────────────────────────────────────────────────────────────────────
// lib/sellers/seller.service.ts
//
// All Phase 2 business logic for seller registration, email/phone
// verification, and the seller status state machine.
//
// DESIGN PRINCIPLES (per scaling doc §3.1):
//   • Every function that reads or writes seller data scopes by userId
//     or sellerId — never by a caller-supplied seller ID that hasn't been
//     cross-checked against the authenticated session.
//   • OTPs are never stored in plaintext; bcrypt hashed at creation,
//     compared via bcrypt.compare at verification.
//   • State machine transitions are validated in this service layer, not
//     just in the API handler, so the invariants hold even if a second
//     API path is added later.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";
import { generateSecureToken } from "@/lib/security/tokens";
import { sendSellerVerificationEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import bcrypt from "bcryptjs";

// OTP config
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_DIGITS = 6;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 60;
const OTP_RATE_LIMIT_MAX = 5; // max OTP requests per phone per hour

// Email verification token expiry
const EMAIL_TOKEN_EXPIRY_HOURS = 24;

// Resend-email rate limit — deliberately tighter than the OTP one above.
// Email resend has no SMS-cost ceiling forcing restraint the way phone
// OTP does, so it needs its own explicit cap to prevent inbox spam / a
// resend button being clicked repeatedly.
const RESEND_EMAIL_RATE_LIMIT_WINDOW_MINUTES = 15;
const RESEND_EMAIL_RATE_LIMIT_MAX = 3; // max resends per seller per 15 min

// Terms version — bump this string when ToS changes so you know which
// version each seller agreed to.
export const CURRENT_TERMS_VERSION = "2.0-marketplace-june-2026";

// ── Seller state machine ─────────────────────────────────────────────────

export type SellerStatus =
  | "pending"
  | "pending_email_verification"
  | "pending_phone_verification"
  | "pending_kyc"
  | "pending_approval"
  | "active"
  | "suspended"
  | "banned"
  | "rejected";

// Valid transitions — no code outside this service should call
// prisma.seller.update({ data: { status } }) directly.
const VALID_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  pending: ["pending_email_verification"],
  pending_email_verification: ["pending_phone_verification"],
  pending_phone_verification: ["pending_kyc"],
  pending_kyc: ["pending_approval"],
  pending_approval: ["active", "rejected", "pending_kyc"], // pending_kyc added in Phase 3 — see lib/sellers/verification.service.ts header comment
  active: ["suspended", "banned"],
  suspended: ["active", "banned"],
  banned: [],   // terminal
  rejected: [], // terminal (can re-apply — handled by creating a new seller row)
};

export async function transitionSellerStatus(
  sellerId: string,
  to: SellerStatus,
  actorUserId: string
): Promise<void> {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { status: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });

  const from = seller.status as SellerStatus;
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new AppError("VALIDATION_ERROR", {
      status: `Cannot transition from '${from}' to '${to}'.`,
    });
  }

  await prisma.seller.update({ where: { id: sellerId }, data: { status: to as any } });
}

// ── Application ──────────────────────────────────────────────────────────

export async function applySeller(params: {
  userId: string;
  sellerType: "individual" | "business";
  displayName: string;
  businessEmail: string;
  businessPhone: string;
  registrationIp: string;
  registrationUserAgent: string | null;
}): Promise<{ seller: { id: string }; verifyToken: string }> {
  // Prevent duplicate applications from the same user
  const existing = await prisma.seller.findUnique({
    where: { userId: params.userId },
    select: { id: true, status: true },
  });

  if (existing) {
    // If previously rejected, we allow re-application by creating a fresh
    // seller record (per the state machine design — rejected is terminal for
    // the existing record). For now, disallow to keep Phase 2 simple; Phase 3
    // (KYC) can add re-application logic.
    throw new AppError("VALIDATION_ERROR", {
      application: "You already have a seller application. Check your verification status.",
    });
  }

  // Verify the user account exists and is a buyer (not already a seller/admin)
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true, emailVerified: true },
  });
  if (!user) throw new AppError("VALIDATION_ERROR", { user: "User account not found." });
  if (user.role !== "customer") {
    throw new AppError("VALIDATION_ERROR", {
      role: "Only buyer accounts can apply to become a seller.",
    });
  }
  if (!user.emailVerified) {
    throw new AppError("VALIDATION_ERROR", {
      email: "Please verify your account email before applying to sell.",
    });
  }

  // Generate email verification token
  const verifyToken = generateSecureToken();
  const verifyExpires = new Date(Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const seller = await prisma.$transaction(async (tx) => {
    // Update user role to seller type
    await tx.user.update({
      where: { id: params.userId },
      data: {
        role: params.sellerType === "individual" ? "seller_individual" : "seller_business",
      },
    });

    // Create seller record
    return tx.seller.create({
      data: {
        userId: params.userId,
        sellerType: params.sellerType,
        status: "pending_email_verification",
        displayName: params.displayName,
        businessEmail: params.businessEmail,
        businessPhone: params.businessPhone,
        registrationIp: params.registrationIp,
        registrationUserAgent: params.registrationUserAgent,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        agreedToTermsAt: new Date(),
        agreedToTermsVersion: CURRENT_TERMS_VERSION,
      },
      select: { id: true },
    });
  });

  // Send verification email — using the seller-specific function, which
  // links to /seller/verify-email, not the buyer /verify-email page.
  //
  // Wrapped in try/catch deliberately: a Resend delivery failure (e.g. no
  // verified sending domain) should not prevent the application itself
  // from being created, nor block the dev-mode link below from printing.
  // The buyer registration flow at app/api/auth/register/route.ts doesn't
  // face this risk the same way since its dev log is unconditional and
  // independent of the email call's outcome — replicating that
  // independence here, but additionally guarding against a throw.
  try {
    await sendSellerVerificationEmail(
      params.businessEmail,
      verifyToken,
      params.displayName
    );
  } catch (emailError) {
    console.error("[seller.apply] sendSellerVerificationEmail failed:", emailError);
  }

  // Matches the exact pattern in app/api/auth/register/route.ts: always
  // print the dev link independently of whether the email actually sent,
  // rather than relying on sendSellerVerificationEmail's internal
  // getResendClient() check. That internal check only logs when
  // RESEND_API_KEY is unset — if a key IS set but the account has no
  // verified sending domain (a real, separate failure mode), Resend can
  // accept the request without delivering it, and the dev fallback never
  // fires. This unconditional log is the same safety net the buyer flow
  // already relies on, so the link is visible in development regardless
  // of Resend's account state.
  if (process.env.NODE_ENV !== "production") {
    const devLink = `${process.env.APP_URL || "http://localhost:3000"}/seller/verify-email?token=${verifyToken}`;
    console.log("\n[DEV ONLY] Seller verification link for", params.businessEmail, ":\n", devLink, "\n");
  }

  await logAuditEvent({
    userId: params.userId,
    action: "seller.apply",
    resourceType: "seller",
    resourceId: seller.id,
    ipAddress: params.registrationIp,
    userAgent: params.registrationUserAgent,
    newValues: { sellerType: params.sellerType, displayName: params.displayName },
  });

  return { seller, verifyToken };
}

// ── Email verification ───────────────────────────────────────────────────

export async function verifySellerEmail(
  token: string,
  ipAddress: string
): Promise<{ sellerId: string; alreadyVerified?: true }> {
  const seller = await prisma.seller.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, status: true, userId: true, emailVerifiedAt: true, emailVerifyExpires: true },
  });

  if (!seller) {
    // No seller has ever had this exact token — genuinely invalid.
    throw new AppError("AUTH_TOKEN_EXPIRED");
  }

  // Already verified is a settled, known state, not an error — check this
  // before expiry, so a second click on the same email link (a normal
  // thing people do) doesn't show a scary "expired" message.
  if (seller.emailVerifiedAt) {
    return { sellerId: seller.id, alreadyVerified: true };
  }

  if (!seller.emailVerifyExpires || seller.emailVerifyExpires < new Date()) {
    throw new AppError("AUTH_TOKEN_EXPIRED");
  }

  if (seller.status !== "pending_email_verification") {
    throw new AppError("VALIDATION_ERROR", {
      token: "Application is in an unexpected state.",
    });
  }

  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      emailVerifiedAt: new Date(),
      // Token is intentionally KEPT (not nulled) — same reasoning as the
      // buyer flow: a repeat visit to this exact link should still be
      // recognized as "already verified" above, not fall through to a
      // generic invalid-token error.
      emailVerifyExpires: null,
      status: "pending_phone_verification",
    },
  });

  await logAuditEvent({
    userId: seller.userId,
    action: "seller.email_verified",
    resourceType: "seller",
    resourceId: seller.id,
    ipAddress,
  });

  return { sellerId: seller.id };
}

/**
 * Re-issues a fresh email verification token and sends a new email.
 *
 * Rate-limited via the existing Redis sliding-window rate limiter (the
 * same one used for login attempts elsewhere in this codebase) rather
 * than adding a new DB column just to track "last resend time" — this
 * keeps the schema unchanged for what's fundamentally a request-frequency
 * concern, not a durable business fact worth persisting.
 *
 * Always issues a NEW token rather than re-sending the old one. The old
 * token is invalidated by being overwritten — clicking an old email link
 * after requesting a resend correctly fails as expired/invalid, rather
 * than two valid links existing simultaneously.
 */
export async function resendSellerVerificationEmail(params: {
  userId: string;
  ipAddress: string;
}): Promise<void> {
  const seller = await prisma.seller.findUnique({
    where: { userId: params.userId },
    select: { id: true, status: true, businessEmail: true, displayName: true, emailVerifiedAt: true },
  });

  if (!seller) throw new AppError("VALIDATION_ERROR", { seller: "No seller application found." });

  if (seller.emailVerifiedAt || seller.status !== "pending_email_verification") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Email verification is not currently required for your application.",
    });
  }
  if (!seller.businessEmail) {
    throw new AppError("VALIDATION_ERROR", { email: "No business email on file." });
  }

  const { allowed, retryAfterSeconds } = await rateLimit(
    `seller:resend-email:${seller.id}`,
    RESEND_EMAIL_RATE_LIMIT_MAX,
    RESEND_EMAIL_RATE_LIMIT_WINDOW_MINUTES * 60
  );
  if (!allowed) {
    throw new AppError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds });
  }

  const verifyToken = generateSecureToken();
  const verifyExpires = new Date(Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.seller.update({
    where: { id: seller.id },
    data: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires },
  });

  try {
    await sendSellerVerificationEmail(seller.businessEmail, verifyToken, seller.displayName ?? "there");
  } catch (emailError) {
    console.error("[seller.resendEmail] sendSellerVerificationEmail failed:", emailError);
  }

  if (process.env.NODE_ENV !== "production") {
    const devLink = `${process.env.APP_URL || "http://localhost:3000"}/seller/verify-email?token=${verifyToken}`;
    console.log("\n[DEV ONLY] Resent seller verification link for", seller.businessEmail, ":\n", devLink, "\n");
  }

  await logAuditEvent({
    userId: params.userId,
    action: "seller.email_verification_resent",
    resourceType: "seller",
    resourceId: seller.id,
    ipAddress: params.ipAddress,
  });
}

// ── Phone OTP ────────────────────────────────────────────────────────────

function generateOtp(): string {
  // Cryptographically random 6-digit OTP
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(OTP_DIGITS, "0");
}

export async function requestPhoneOtp(params: {
  sellerId: string;
  phone: string;
  requestIp: string;
}): Promise<void> {
  const seller = await prisma.seller.findUnique({
    where: { id: params.sellerId },
    select: { id: true, status: true, userId: true },
  });
  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });

  if (seller.status !== "pending_phone_verification") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Phone verification is not currently required for your application.",
    });
  }

  // Rate limit: count OTP requests for this phone in the last hour
  // (using the SellerOtpLog table as the source of truth)
  const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const recentCount = await prisma.sellerOtpLog.count({
    where: {
      sellerId: params.sellerId,
      phone: params.phone,
      createdAt: { gte: windowStart },
    },
  });
  if (recentCount >= OTP_RATE_LIMIT_MAX) {
    throw new AppError("RATE_LIMIT_EXCEEDED", {
      message: `Too many OTP requests. Please wait before requesting another code.`,
    });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = await bcrypt.hash(otp, 10); // 10 rounds is fine for a short-lived OTP

  // Store hashed OTP
  await prisma.$transaction(async (tx) => {
    // Log the request (rate-limiting record + audit trail)
    await tx.sellerOtpLog.create({
      data: {
        sellerId: params.sellerId,
        phone: params.phone,
        otpHash,
        expiresAt,
      },
    });

    // Store the latest OTP on the seller row for fast lookup at verify time
    await tx.seller.update({
      where: { id: params.sellerId },
      data: {
        businessPhone: params.phone,
        phoneOtp: otpHash,
        phoneOtpExpires: expiresAt,
        phoneOtpAttempts: 0, // reset on new OTP
      },
    });
  });

  // Send OTP via SMS
  await sendOtpSms(params.phone, otp);
}

export async function verifyPhoneOtp(params: {
  sellerId: string;
  phone: string;
  code: string;
  ipAddress: string;
}): Promise<void> {
  const seller = await prisma.seller.findUnique({
    where: { id: params.sellerId },
    select: {
      id: true,
      userId: true,
      status: true,
      phoneOtp: true,
      phoneOtpExpires: true,
      phoneOtpAttempts: true,
      businessPhone: true,
    },
  });

  if (!seller) throw new AppError("VALIDATION_ERROR", { sellerId: "Seller not found." });
  if (seller.status !== "pending_phone_verification") {
    throw new AppError("VALIDATION_ERROR", {
      status: "Phone verification is not currently required.",
    });
  }

  // Brute-force guard
  if (seller.phoneOtpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError("AUTH_ACCOUNT_LOCKED");
  }

  // Check expiry first (before comparing, to avoid timing oracle on expired OTPs)
  if (!seller.phoneOtp || !seller.phoneOtpExpires || seller.phoneOtpExpires < new Date()) {
    throw new AppError("AUTH_TOKEN_EXPIRED");
  }

  // Increment attempts BEFORE comparing (fail-safe: if the server crashes
  // between increment and compare, it's safer to have overcounted than
  // undercounted attempts)
  await prisma.seller.update({
    where: { id: seller.id },
    data: { phoneOtpAttempts: { increment: 1 } },
  });

  const matches = await bcrypt.compare(params.code, seller.phoneOtp);
  if (!matches) {
    throw new AppError("AUTH_2FA_INVALID");
  }

  // Mark OTP log as used
  await prisma.sellerOtpLog.updateMany({
    where: {
      sellerId: params.sellerId,
      phone: params.phone,
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
    data: { usedAt: new Date() },
  });

  // Advance state machine
  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      phoneVerifiedAt: new Date(),
      phoneOtp: null,         // consume
      phoneOtpExpires: null,
      phoneOtpAttempts: 0,
      status: "pending_kyc", // next phase
    },
  });

  await logAuditEvent({
    userId: seller.userId,
    action: "seller.phone_verified",
    resourceType: "seller",
    resourceId: seller.id,
    ipAddress: params.ipAddress,
  });
}

// ── Status query ─────────────────────────────────────────────────────────

export async function getSellerStatus(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      sellerType: true,
      displayName: true,
      businessEmail: true,
      businessPhone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      agreedToTermsAt: true,
      agreedToTermsVersion: true,
      createdAt: true,
    },
  });
  if (!seller) return null;

  return {
    sellerId: seller.id,
    status: seller.status,
    sellerType: seller.sellerType,
    displayName: seller.displayName,
    // Next step hint for the UI — driven purely by status, not by a
    // separate field, so status stays the single source of truth.
    nextStep: nextStepForStatus(seller.status as SellerStatus),
    verification: {
      emailVerified: !!seller.emailVerifiedAt,
      phoneVerified: !!seller.phoneVerifiedAt,
    },
    agreedToTermsAt: seller.agreedToTermsAt,
    createdAt: seller.createdAt,
  };
}

function nextStepForStatus(status: SellerStatus): string {
  const steps: Record<SellerStatus, string> = {
    pending: "Complete your seller application.",
    pending_email_verification: "Check your business email and click the verification link.",
    pending_phone_verification: "Verify your phone number with the OTP sent to your device.",
    pending_kyc: "Upload your identity documents to complete KYC verification.",
    pending_approval: "Your documents are under review. We'll notify you within 2-3 business days.",
    active: "Your seller account is active. Visit Seller Central to manage your store.",
    suspended: "Your account is suspended. Please contact support.",
    banned: "Your account has been permanently banned.",
    rejected: "Your application was rejected. Please contact support for details.",
  };
  return steps[status] ?? "Unknown status.";
}

// ── SMS provider: D7 Networks ─────────────────────────────────────────────
// Pakistan-local aggregator routing through Jazz/Zong/Telenor/Ufone. Chosen
// over Twilio/Vonage for lower per-SMS cost and better local deliverability
// on Pakistani numbers (see scaling doc Open Question #1).
//
// API reference: https://d7networks.com/docs/sms/send-sms/
//   POST https://api.d7networks.com/messages/v1/send
//   Auth: Bearer token (D7_API_TOKEN)
//   originator (D7_SENDER_ID) must be PTA-registered before going live —
//   see https://d7networks.com/sms-senderid-registration/. Until that
//   registration completes, D7 may reject or silently fail sends with an
//   unregistered sender ID; this is an account-setup step outside this
//   codebase.
const D7_API_URL = "https://api.d7networks.com/messages/v1/send";

// Normalizes to the +92XXXXXXXXXX format D7 expects in `recipients`.
// Accepts the same shapes PK_PHONE_REGEX validates: 03XXXXXXXXX, 3XXXXXXXXX,
// +923XXXXXXXXX, 00923XXXXXXXXX.
function toE164Pakistan(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0092")) return `+92${digits.slice(4)}`;
  if (digits.startsWith("92")) return `+${digits}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+92${digits}`; // bare 3XXXXXXXXX
}

async function sendOtpSms(phone: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[DEV] OTP for ${phone}: ${otp} (not sent — D7_API_TOKEN not used in dev)\n`);
    return;
  }

  const apiToken = process.env.D7_API_TOKEN;
  const senderId = process.env.D7_SENDER_ID;

  if (!apiToken || !senderId) {
    // Fail loudly rather than silently succeeding with no SMS actually
    // sent — a misconfigured production deploy should surface as a clear
    // 500 to the caller (and to monitoring), not a false "OTP sent".
    throw new AppError("SERVER_ERROR", {
      message: "SMS provider is not configured (missing D7_API_TOKEN or D7_SENDER_ID).",
    });
  }

  const recipient = toE164Pakistan(phone);

  let response: Response;
  try {
    response = await fetch(D7_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            channel: "sms",
            recipients: [recipient],
            content: `Your Nexora seller verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
            msg_type: "text",
            data_coding: "text",
            tag: "seller_phone_otp",
          },
        ],
        message_globals: {
          originator: senderId,
        },
      }),
    });
  } catch (networkError) {
    // Network-level failure (DNS, timeout, D7 outage) — don't leak the raw
    // error to the client; the caller (requestPhoneOtp) has already
    // written the OTP+hash to the DB by this point, so the seller can
    // request a fresh OTP once the provider is reachable again.
    throw new AppError("SERVER_ERROR", {
      message: "Could not reach the SMS provider. Please try requesting the code again shortly.",
    });
  }

  if (!response.ok) {
    // Surface SPECIFIC known D7 failure modes with an actionable message;
    // anything else gets a generic message so provider internals never
    // reach the client response.
    if (response.status === 402) {
      throw new AppError("SERVER_ERROR", {
        message: "SMS sending is temporarily unavailable. Please try again later.",
      });
    }
    if (response.status === 401) {
      // Misconfigured/expired token — an operations problem, not the
      // seller's. Still don't leak "401" or token details to them.
      throw new AppError("SERVER_ERROR", {
        message: "SMS sending is temporarily unavailable. Please try again later.",
      });
    }
    throw new AppError("SERVER_ERROR", {
      message: "Could not send the verification code. Please try again.",
    });
  }

  // D7 returns { request_id, status: "accepted" | "rejected", created_at }
  // on HTTP 200 — a 200 with status "rejected" is still possible (e.g.
  // malformed recipient D7's own validation catches that ours didn't).
  const result = (await response.json().catch(() => null)) as
    | { request_id?: string; status?: string }
    | null;

  if (result?.status === "rejected") {
    throw new AppError("SERVER_ERROR", {
      message: "Could not send the verification code to this number. Please check the number and try again.",
    });
  }
}
