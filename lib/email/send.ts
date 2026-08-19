import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_API_KEY is not set — skipping real email send."
    );
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  name: string
) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const client = getResendClient();
  if (!client) return;

  await client.emails.send({
    from: FROM,
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1A3C5E;">Welcome, ${name}!</h2>
        <p>Please confirm your email address to activate your account.</p>
        <a href="${link}" style="display:inline-block;background:#2E86C1;color:#fff;
           padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:12px;">
          Verify Email
        </a>
        <p style="margin-top:24px;color:#7F8C8D;font-size:13px;">
          This link expires in 24 hours. If you didn't create this account, you can ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  name: string
) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const client = getResendClient();
  if (!client) return;

  await client.emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1A3C5E;">Hi ${name},</h2>
        <p>We received a request to reset your password. Click below to choose a new one.</p>
        <a href="${link}" style="display:inline-block;background:#2E86C1;color:#fff;
           padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:12px;">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#7F8C8D;font-size:13px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

// ── NEW: Order confirmation email ──────────────────────────────────────────

interface OrderEmailItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export async function sendOrderConfirmationEmail(order: OrderEmailData) {
  const client = getResendClient();
  if (!client) {
    console.log("[email] DEV: Order confirmation would be sent to", order.customerEmail);
    return;
  }

  const orderUrl = `${APP_URL}/orders`;

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;">
          ${item.productName}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;text-align:center;">
          ×${item.quantity}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;text-align:right;">
          PKR ${Number(item.totalPrice).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  const addr = order.shippingAddress;
  const addressHtml = [
    addr.fullName,
    addr.phone,
    addr.addressLine1,
    addr.addressLine2,
    `${addr.city}, ${addr.state} ${addr.postalCode}`,
    addr.country,
  ]
    .filter(Boolean)
    .join("<br/>");

  await client.emails.send({
    from: FROM,
    to: order.customerEmail,
    subject: `Order Confirmed — ${order.orderNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">ORDER CONFIRMED</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${order.customerName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Thank you for your order! We've received it and will get it ready for delivery soon.
      </p>

      <!-- Order number -->
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Order Number</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#0d0d0d;font-family:monospace;">${order.orderNumber}</p>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:8px;border-bottom:2px solid #eee;">Item</th>
            <th style="text-align:center;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:8px;border-bottom:2px solid #eee;">Qty</th>
            <th style="text-align:right;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:8px;border-bottom:2px solid #eee;">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <!-- Totals -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="font-size:13px;color:#666;padding:4px 0;">Subtotal</td>
          <td style="font-size:13px;color:#333;text-align:right;padding:4px 0;">PKR ${order.subtotal.toFixed(2)}</td>
        </tr>
        ${order.discountAmount > 0 ? `
        <tr>
          <td style="font-size:13px;color:#27ae60;padding:4px 0;">Discount</td>
          <td style="font-size:13px;color:#27ae60;text-align:right;padding:4px 0;">-PKR ${order.discountAmount.toFixed(2)}</td>
        </tr>` : ""}
        <tr>
          <td style="font-size:13px;color:#666;padding:4px 0;">Shipping</td>
          <td style="font-size:13px;color:#27ae60;text-align:right;padding:4px 0;">Free</td>
        </tr>
        <tr>
          <td style="font-size:15px;font-weight:bold;color:#0d0d0d;padding:10px 0 4px;border-top:2px solid #eee;">Total</td>
          <td style="font-size:15px;font-weight:bold;color:#c9a96e;text-align:right;padding:10px 0 4px;border-top:2px solid #eee;">PKR ${order.total.toFixed(2)}</td>
        </tr>
      </table>

      <!-- Payment method -->
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Payment Method</p>
        <p style="margin:4px 0 0;font-size:14px;color:#333;">${order.paymentMethod}</p>
      </div>

      <!-- Shipping address -->
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:28px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Delivering To</p>
        <p style="margin:6px 0 0;font-size:14px;color:#333;line-height:1.7;">${addressHtml}</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${orderUrl}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VIEW MY ORDERS
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">
        © ${new Date().getFullYear()} Nexora. If you have questions, reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ── Phase 2: Seller business-email verification ────────────────────────────

export async function sendSellerVerificationEmail(
  to: string,
  token: string,
  displayName: string
) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/verify-email?token=${token}`;

  if (!client) {
    console.log(
      `[email] DEV: Seller verification email would be sent to ${to} — link: ${link}`
    );
    return;
  }

  await client.emails.send({
    from: FROM,
    to,
    subject: "Verify your business email — Nexora Seller Central",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Thanks for applying to sell on Nexora. Confirm your business email address
        to continue your application — phone verification is next.
      </p>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VERIFY BUSINESS EMAIL
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        This link expires in 24 hours. If you didn't apply to become a Nexora seller,
        you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">
        © ${new Date().getFullYear()} Nexora. If you have questions, reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ── Phase 3: KYC document review outcome ────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id: "National ID",
  passport: "Passport",
  business_registration: "Business Registration Certificate",
  trade_license: "Trade License",
  tax_certificate: "Tax Certificate",
};

export async function sendSellerKycApprovedEmail(to: string, displayName: string) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/status`;

  if (!client) {
    console.log(`[email] DEV: KYC approved email would be sent to ${to}`);
    return;
  }

  await client.emails.send({
    from: FROM,
    to,
    subject: "You're approved — welcome to Nexora Seller Central",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Congratulations, ${displayName}!</p>
      <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your identity verification is complete and your Nexora seller account is now active.
        You can start setting up your store.
      </p>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          GO TO SELLER CENTRAL
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

export async function sendSellerKycDocumentRejectedEmail(
  to: string,
  displayName: string,
  docType: string,
  reason: string
) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/verify-kyc`;
  const docLabel = DOC_TYPE_LABELS[docType] ?? docType;

  if (!client) {
    console.log(
      `[email] DEV: KYC rejection email would be sent to ${to} — doc: ${docLabel}, reason: ${reason}`
    );
    return;
  }

  await client.emails.send({
    from: FROM,
    to,
    subject: `Action needed: ${docLabel} could not be verified`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 16px;line-height:1.6;">
        We weren't able to verify the <strong>${docLabel}</strong> you submitted. Please review the note below and re-upload.
      </p>
      <div style="background:#fff8f6;border:1px solid #f3d9d2;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#a33;text-transform:uppercase;letter-spacing:1px;">Reviewer Note</p>
        <p style="margin:6px 0 0;font-size:14px;color:#333;">${reason}</p>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          RE-UPLOAD DOCUMENT
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  return: "Return Request",
  refund: "Refund Request",
  chargeback: "Chargeback / Item Not Received",
};

// ── Sent to the SELLER when a buyer opens a dispute ──────────────────────
export async function sendDisputeOpenedToSellerEmail(params: {
  to: string;
  sellerName: string;
  productName: string;
  orderNumber: string;
  disputeType: string;
  buyerReason: string;
}) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/disputes`;
  const typeLabel = DISPUTE_TYPE_LABELS[params.disputeType] ?? params.disputeType;

  if (!client) {
    console.log(`[email] DEV: Dispute opened email would be sent to seller ${params.to}`);
    return;
  }

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: `Action needed: ${typeLabel} opened — ${params.productName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.sellerName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        A buyer has opened a <strong>${typeLabel}</strong> on order <strong>${params.orderNumber}</strong>.
      </p>
      <div style="background:#fff8f6;border:1px solid #f3d9d2;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#a33;text-transform:uppercase;letter-spacing:1px;">Product</p>
        <p style="margin:4px 0 8px;font-size:14px;color:#333;">${params.productName}</p>
        <p style="margin:0;font-size:12px;color:#a33;text-transform:uppercase;letter-spacing:1px;">Buyer's reason</p>
        <p style="margin:4px 0 0;font-size:14px;color:#333;">${params.buyerReason}</p>
      </div>
      <p style="color:#555;font-size:13px;margin:0 0 20px;line-height:1.6;">
        Please respond within 3 business days. You can accept the dispute (issue a full refund),
        reject it with a reason, or escalate to Nexora admin for arbitration.
      </p>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          RESPOND TO DISPUTE
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ── Sent to the BUYER when a seller responds (accepted or rejected) ───────
export async function sendDisputeSellerResponseToBuyerEmail(params: {
  to: string;
  buyerName: string;
  productName: string;
  orderNumber: string;
  action: "accept" | "reject" | "escalate";
  sellerResponse: string;
}) {
  const client = getResendClient();
  const link = `${APP_URL}/orders`;

  if (!client) {
    console.log(`[email] DEV: Dispute seller response email would be sent to buyer ${params.to}`);
    return;
  }

  const actionSummary =
    params.action === "accept"
      ? "The seller has accepted your dispute and issued a full refund."
      : params.action === "escalate"
      ? "The seller has escalated your dispute to Nexora admin for final review."
      : "The seller has responded to your dispute. If you disagree, Nexora admin will review it.";

  const subjectLine =
    params.action === "accept"
      ? `Dispute resolved — refund issued for ${params.productName}`
      : `Dispute update — ${params.productName}`;

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: subjectLine,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">DISPUTE UPDATE</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.buyerName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        ${actionSummary}
      </p>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Order</p>
        <p style="margin:4px 0 8px;font-size:14px;color:#333;">${params.orderNumber} — ${params.productName}</p>
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Seller note</p>
        <p style="margin:4px 0 0;font-size:14px;color:#333;">${params.sellerResponse}</p>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VIEW MY ORDERS
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ── Sent to BOTH buyer and seller when admin resolves a dispute ────────────
export async function sendDisputeAdminResolvedEmail(params: {
  to: string;
  recipientName: string;
  productName: string;
  orderNumber: string;
  outcome: "refund" | "deny";
  refundAmount: number | null;
  resolutionNotes: string;
}) {
  const client = getResendClient();
  const link = `${APP_URL}/orders`;

  if (!client) {
    console.log(`[email] DEV: Admin resolved dispute email would be sent to ${params.to}`);
    return;
  }

  const outcomeText =
    params.outcome === "refund"
      ? `Nexora has ruled in the buyer's favour and issued a refund of PKR ${params.refundAmount?.toFixed(2) ?? "the full amount"}.`
      : "Nexora has reviewed the dispute and denied the refund request.";

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: `Dispute resolved by Nexora — ${params.productName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">DISPUTE RESOLVED</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.recipientName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        ${outcomeText}
      </p>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Order</p>
        <p style="margin:4px 0 8px;font-size:14px;color:#333;">${params.orderNumber} — ${params.productName}</p>
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Nexora's notes</p>
        <p style="margin:4px 0 0;font-size:14px;color:#333;">${params.resolutionNotes}</p>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VIEW ORDERS
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}
export async function sendSellerBannedEmail(params: {
  to: string;
  displayName: string;
  reason: string;
}) {
  const client = getResendClient();
  if (!client) {
    console.log(`[email] DEV: Seller banned email would be sent to ${params.to} — reason: ${params.reason}`);
    return;
  }

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: "Your Nexora seller account has been banned",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Your Nexora seller account has been <strong>permanently banned</strong>.
        Your listings have been taken down and any pending payouts have been cancelled.
      </p>
      <div style="background:#fff8f6;border:1px solid #f3d9d2;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#a33;text-transform:uppercase;letter-spacing:1px;">Reason</p>
        <p style="margin:6px 0 0;font-size:14px;color:#333;">${params.reason}</p>
      </div>
      <p style="color:#555;font-size:13px;margin:0 0 20px;line-height:1.6;">
        If you believe this decision was made in error, you can submit an appeal by
        replying directly to this email with your seller ID and an explanation.
      </p>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

export async function sendSellerSuspendedEmail(params: {
  to: string;
  displayName: string;
  reason: string;
  suspendedUntil: Date | null; // null = indefinite
}) {
  const client = getResendClient();
  const untilText = params.suspendedUntil
    ? `until ${params.suspendedUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "until further notice";

  if (!client) {
    console.log(`[email] DEV: Seller suspended email would be sent to ${params.to} — reason: ${params.reason}`);
    return;
  }

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: "Your Nexora seller account has been suspended",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">SELLER CENTRAL</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Your Nexora seller account has been <strong>suspended ${untilText}</strong>.
        Your dashboard access is paused, but your listings and data are not deleted —
        this is a temporary hold.
      </p>
      <div style="background:#fff8f6;border:1px solid #f3d9d2;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#a33;text-transform:uppercase;letter-spacing:1px;">Reason</p>
        <p style="margin:6px 0 0;font-size:14px;color:#333;">${params.reason}</p>
      </div>
      <p style="color:#555;font-size:13px;margin:0 0 20px;line-height:1.6;">
        If you believe this decision was made in error, you can submit an appeal by
        replying directly to this email with your seller ID and an explanation.
      </p>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}
export async function sendAppealAdminReplyEmail(params: {
  to: string;
  displayName: string;
  message: string;
}) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/appeal`;

  if (!client) {
    console.log(`[email] DEV: Appeal admin reply email would be sent to ${params.to}`);
    return;
  }

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: "Nexora has replied to your appeal",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">APPEAL UPDATE</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
        An admin has replied to your appeal:
      </p>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#333;white-space:pre-line;">${params.message}</p>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VIEW & REPLY
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

export async function sendAppealResolvedEmail(params: {
  to: string;
  displayName: string;
  outcome: "uphold" | "lift";
  resolutionNote: string;
}) {
  const client = getResendClient();
  const link = `${APP_URL}/seller/appeal`;

  if (!client) {
    console.log(`[email] DEV: Appeal resolved email would be sent to ${params.to} — outcome: ${params.outcome}`);
    return;
  }

  const heading =
    params.outcome === "lift"
      ? "Your appeal was approved — your account has been reinstated"
      : "Your appeal has been reviewed";

  const body =
    params.outcome === "lift"
      ? "Good news — Nexora has reviewed your appeal and reinstated your seller account. You can log in and resume selling."
      : "Nexora has reviewed your appeal. After careful consideration, the original decision stands.";

  await client.emails.send({
    from: FROM,
    to: params.to,
    subject: heading,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0d0d0d;padding:28px 32px;text-align:center;">
      <h1 style="margin:0;color:#c9a96e;font-size:22px;letter-spacing:2px;">NEXORA</h1>
      <p style="margin:6px 0 0;color:#888;font-size:12px;letter-spacing:1px;">APPEAL RESOLVED</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;margin:0 0 6px;">Hi ${params.displayName},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">${body}</p>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Admin's note</p>
        <p style="margin:6px 0 0;font-size:14px;color:#333;">${params.resolutionNote}</p>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0d0d0d;padding:12px 32px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;">
          VIEW DETAILS
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} Nexora.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

