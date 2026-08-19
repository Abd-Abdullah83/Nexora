// ─────────────────────────────────────────────────────────────────────────
// Payment provider abstraction
//
// Every payment method (COD, Stripe, JazzCash, EasyPaisa, PayPal, Payoneer)
// implements this same interface. The order/checkout code never talks to a
// specific gateway directly — it only talks to PaymentProvider. Adding a
// real gateway later means writing one new file that implements this
// interface and registering it in the PROVIDERS map below. Nothing in
// checkout, orders, or the admin panel needs to change.
//
// IMPORTANT INVARIANT (per Phase 6 spec): stock is decremented on payment
// SUCCESS, never on order creation. Every provider's confirmPayment() is
// the single place stock decrements happen — see order.repository.ts'
// confirmOrderPayment().
// ─────────────────────────────────────────────────────────────────────────

export type PaymentMethodId =
  | "cod"
  | "jazzcash"
  | "easypaisa"
  | "card_pk"
  | "stripe"
  | "paypal"
  | "payoneer";

export interface PaymentIntentResult {
  /** True if the order can proceed to "awaiting confirmation" immediately
   *  (e.g. COD — no gateway round-trip needed). False if the client must
   *  be redirected to a hosted payment UI or an embed must be shown. */
  requiresClientAction: boolean;
  /** Opaque reference the provider gives us — Stripe PaymentIntent id,
   *  JazzCash transaction reference, etc. Stored on the order for later
   *  webhook/refund lookups. Null for providers not yet integrated. */
  providerReference: string | null;
  /** For providers that need the client to do something next (redirect
   *  URL, client secret for Stripe Elements, etc.) */
  clientActionPayload?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  providerRefundReference: string | null;
  message: string;
}

export interface PaymentProvider {
  id: PaymentMethodId;
  label: string;
  /** False = UI shows "coming soon", checkout blocks selecting it server-side too */
  isLive: boolean;

  /**
   * Called when the order is created. For COD, this just confirms intent
   * to pay on delivery — no money moves yet. For real gateways, this is
   * where you'd create a Stripe PaymentIntent / JazzCash transaction and
   * return what the client needs to complete payment.
   */
  createPaymentIntent(params: {
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<PaymentIntentResult>;

  /**
   * Called to refund a previously-paid order. COD refunds are always
   * manual (cash already changed hands) — this just records the intent.
   * Real gateways would call their refund API here.
   */
  refund(params: {
    orderId: string;
    providerReference: string | null;
    amount: number;
  }): Promise<RefundResult>;
}

// ─────────────────────────────────────────────────────────────────────────
// COD — fully implemented, no external account needed
// ─────────────────────────────────────────────────────────────────────────

const codProvider: PaymentProvider = {
  id: "cod",
  label: "Cash on Delivery",
  isLive: true,

  async createPaymentIntent() {
    // No gateway round-trip — order goes straight to "awaiting delivery".
    // Stock is NOT decremented here; it decrements when an admin marks
    // the COD order as paid/collected via confirmOrderPayment().
    return {
      requiresClientAction: false,
      providerReference: null,
    };
  },

  async refund({ amount }) {
    // Cash already exchanged hands — there's nothing to call. This just
    // tells the admin panel the refund must be handled manually.
    return {
      success: true,
      providerRefundReference: null,
      message: `Manual refund required: return PKR ${amount.toFixed(2)} in cash or via bank transfer.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Placeholder providers — UI-visible, server rejects actual use until
// real credentials + SDK integration are added. Each one is a single file
// to fill in later: swap the throw for a real API call.
// ─────────────────────────────────────────────────────────────────────────

function comingSoonProvider(id: PaymentMethodId, label: string): PaymentProvider {
  return {
    id,
    label,
    isLive: false,
    async createPaymentIntent() {
      throw new Error(`${label} is not yet configured. Please choose Cash on Delivery for now.`);
    },
    async refund() {
      throw new Error(`${label} refunds are not yet configured.`);
    },
  };
}

const PROVIDERS: Record<PaymentMethodId, PaymentProvider> = {
  cod: codProvider,
  jazzcash: comingSoonProvider("jazzcash", "JazzCash"),
  easypaisa: comingSoonProvider("easypaisa", "EasyPaisa"),
  card_pk: comingSoonProvider("card_pk", "Credit / Debit Card"),
  stripe: comingSoonProvider("stripe", "Stripe"),
  paypal: comingSoonProvider("paypal", "PayPal"),
  payoneer: comingSoonProvider("payoneer", "Payoneer"),
};

export function getPaymentProvider(id: PaymentMethodId): PaymentProvider {
  return PROVIDERS[id];
}

export function isPaymentMethodLive(id: string): id is PaymentMethodId {
  return id in PROVIDERS && PROVIDERS[id as PaymentMethodId].isLive;
}

export const ALL_PAYMENT_METHODS: PaymentMethodId[] = Object.keys(PROVIDERS) as PaymentMethodId[];
