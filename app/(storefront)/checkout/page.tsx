"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { useCart } from "@/hooks/useCart";

// ── Types ──────────────────────────────────────────────────────────────────

interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AppliedCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  discountAmount: number;
}

type Step = "address" | "payment" | "review" | "confirm";

const EMPTY_ADDRESS: Address = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "Pakistan",
};

// ── Payment methods ────────────────────────────────────────────────────────

type PaymentMethodId =
  | "cod"
  | "jazzcash"
  | "easypaisa"
  | "card_pk"
  | "stripe"
  | "paypal"
  | "payoneer";

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  icon: string;
  region: "local" | "international";
  available: boolean; // false = coming soon
}

const PAYMENT_METHODS: PaymentMethod[] = [
  // ── Local ──
  {
    id: "cod",
    label: "Cash on Delivery",
    description: "Pay when your order arrives",
    icon: "💵",
    region: "local",
    available: true,
  },
  {
    id: "jazzcash",
    label: "JazzCash",
    description: "Pay via JazzCash mobile wallet",
    icon: "📱",
    region: "local",
    available: false,
  },
  {
    id: "easypaisa",
    label: "EasyPaisa",
    description: "Pay via EasyPaisa mobile wallet",
    icon: "💳",
    region: "local",
    available: false,
  },
  {
    id: "card_pk",
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, NayaPay, Meezan, HBL, UBL, etc.",
    icon: "🏦",
    region: "local",
    available: false,
  },
  // ── International ──
  {
    id: "stripe",
    label: "Stripe",
    description: "Pay securely with any international card",
    icon: "💳",
    region: "international",
    available: false,
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Pay with your PayPal account",
    icon: "🅿️",
    region: "international",
    available: false,
  },
  {
    id: "payoneer",
    label: "Payoneer",
    description: "Pay via Payoneer",
    icon: "🌐",
    region: "international",
    available: false,
  },
];

// ── CSRF helper ────────────────────────────────────────────────────────────
function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "address", label: "Address" },
    { key: "payment", label: "Payment" },
    { key: "review", label: "Review" },
    { key: "confirm", label: "Place Order" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="mb-8 flex items-center flex-wrap gap-y-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${i < currentIdx
                ? "bg-brass text-ink"
                : i === currentIdx
                  ? "border-2 border-brass text-brass"
                  : "border border-white/20 text-slate/50"
              }`}
          >
            {i < currentIdx ? "✓" : i + 1}
          </div>
          <span
            className={`ml-2 text-xs ${i === currentIdx ? "text-cream" : "text-slate/60"
              }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-3 h-px w-6 transition ${i < currentIdx ? "bg-brass" : "bg-white/10"
                }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Reusable input field ───────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-slate">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-2.5 text-sm text-cream outline-none transition focus:border-brass/60"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Address form ───────────────────────────────────────────────────────────
function AddressForm({
  address,
  onChange,
  errors,
}: {
  address: Address;
  onChange: (a: Address) => void;
  errors: Partial<Record<keyof Address, string>>;
}) {
  function set(field: keyof Address, value: string) {
    onChange({ ...address, [field]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" value={address.fullName} onChange={(v) => set("fullName", v)} error={errors.fullName} placeholder="Muhammad Abdullah" />
        <Field label="Phone Number" value={address.phone} onChange={(v) => set("phone", v)} error={errors.phone} type="tel" placeholder="+92 300 0000000" />
      </div>
      <Field label="Address Line 1" value={address.addressLine1} onChange={(v) => set("addressLine1", v)} error={errors.addressLine1} placeholder="House / Street / Block" />
      <Field label="Address Line 2 (optional)" value={address.addressLine2} onChange={(v) => set("addressLine2", v)} placeholder="Landmark, area etc." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" value={address.city} onChange={(v) => set("city", v)} error={errors.city} placeholder="Lahore" />
        <Field label="Province" value={address.state} onChange={(v) => set("state", v)} error={errors.state} placeholder="Punjab" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postal Code" value={address.postalCode} onChange={(v) => set("postalCode", v)} error={errors.postalCode} placeholder="54000" />
        <Field label="Country" value={address.country} onChange={(v) => set("country", v)} error={errors.country} />
      </div>
    </div>
  );
}

// ── Payment method selector ────────────────────────────────────────────────
function PaymentSelector({
  selected,
  onSelect,
}: {
  selected: PaymentMethodId | null;
  onSelect: (id: PaymentMethodId) => void;
}) {
  const local = PAYMENT_METHODS.filter((m) => m.region === "local");
  const international = PAYMENT_METHODS.filter((m) => m.region === "international");

  function MethodCard({ method }: { method: PaymentMethod }) {
    const isSelected = selected === method.id;
    return (
      <button
        type="button"
        onClick={() => method.available && onSelect(method.id)}
        className={`relative flex items-center gap-3 rounded-sm border p-4 text-left transition ${!method.available
            ? "cursor-not-allowed border-white/[0.06] opacity-50"
            : isSelected
              ? "border-brass bg-brass/10"
              : "border-white/10 hover:border-brass/40"
          }`}
      >
        <span className="text-2xl">{method.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isSelected ? "text-brass" : "text-cream"}`}>
            {method.label}
          </p>
          <p className="text-xs text-slate/70 mt-0.5 truncate">{method.description}</p>
        </div>
        {!method.available && (
          <span className="absolute right-2 top-2 rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] text-slate/60">
            Soon
          </span>
        )}
        {isSelected && method.available && (
          <div className="flex-shrink-0 h-4 w-4 rounded-full bg-brass flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-ink" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Local Pakistan */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate/60">
          🇵🇰 Pakistan
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {local.map((m) => <MethodCard key={m.id} method={m} />)}
        </div>
      </div>

      {/* International */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate/60">
          🌍 International
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {international.map((m) => <MethodCard key={m.id} method={m} />)}
        </div>
      </div>
    </div>
  );
}

// ── Order summary sidebar ──────────────────────────────────────────────────
function OrderSummary({
  items,
  subtotal,
  coupon,
}: {
  items: ReturnType<typeof useCart>["items"];
  subtotal: number;
  coupon: AppliedCoupon | null;
}) {
  const discount = coupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
      <h3 className="mb-4 font-display text-base text-cream">Order Summary</h3>
      <div className="mb-4 flex flex-col gap-3 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3">
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} className="h-10 w-10 flex-shrink-0 rounded-sm border border-white/10 object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs text-cream">{item.name}</p>
              <p className="text-xs text-slate">×{item.quantity}</p>
            </div>
            <span className="text-xs text-brass flex-shrink-0">
              PKR {(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.08] pt-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-slate">
          <span>Subtotal</span>
          <span>PKR {subtotal.toFixed(2)}</span>
        </div>
        {coupon && (
          <div className="flex justify-between text-emerald-400">
            <span>Coupon ({coupon.code})</span>
            <span>-PKR {discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-slate">
          <span>Shipping</span>
          <span className="text-emerald-400">Free</span>
        </div>
        <div className="mt-1 border-t border-white/[0.08] pt-2 flex justify-between font-semibold text-cream">
          <span>Total</span>
          <span>PKR {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main checkout page ─────────────────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, isLoading } = useCart();

  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof Address, string>>>({});

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodId | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const idempotencyKey = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const discount = coupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (!isLoading && items.length === 0) router.replace("/");
  }, [items, isLoading, router]);

  // ── Validate address ──────────────────────────────────────────────────────
  function validateAddress(): boolean {
    const e: Partial<Record<keyof Address, string>> = {};
    if (!address.fullName.trim()) e.fullName = "Full name is required.";
    if (!address.phone.trim()) e.phone = "Phone is required.";
    if (!address.addressLine1.trim()) e.addressLine1 = "Address is required.";
    if (!address.city.trim()) e.city = "City is required.";
    if (!address.state.trim()) e.state = "Province is required.";
    if (!address.postalCode.trim()) e.postalCode = "Postal code is required.";
    if (!address.country.trim()) e.country = "Country is required.";
    setAddressErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Validate payment ──────────────────────────────────────────────────────
  function validatePayment(): boolean {
    if (!selectedPayment) {
      setPaymentError("Please select a payment method.");
      return false;
    }
    setPaymentError(null);
    return true;
  }

  // ── Coupon ────────────────────────────────────────────────────────────────
  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCoupon(null);
    try {
      const res = await fetch("/api/checkout/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ code: couponInput, subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error ?? "Invalid coupon.");
      } else {
        setCoupon(data.coupon);
      }
    } catch {
      setCouponError("Network error.");
    } finally {
      setCouponLoading(false);
    }
  }

  // ── Place order ───────────────────────────────────────────────────────────
  async function placeOrder() {
    setSubmitting(true);
    setOrderError(null);

    try {
      const res = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrf(),
        },
        body: JSON.stringify({
          shippingAddress: address,
          couponCode: coupon?.code,
          paymentMethod: selectedPayment,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setOrderError(data.error?.message ?? "Could not place order.");
        return;
      }

      await clearCart();
      router.push(`/orders/${data.order.id}/confirmation`);
    } catch {
      setOrderError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink">
        <StorefrontHeader />
        <p className="mt-20 text-center text-sm text-slate">Loading...</p>
      </div>
    );
  }

  const paymentMethodLabel =
    PAYMENT_METHODS.find((m) => m.id === selectedPayment)?.label ?? "";

  return (
    <div className="min-h-screen bg-ink">
      <StorefrontHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/" className="text-sm text-slate hover:text-brass transition">
            ← Continue Shopping
          </Link>
          <h1 className="font-display text-2xl text-cream">Checkout</h1>
        </div>

        <StepBar current={step} />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* ── Left: step content ── */}
          <div className="flex flex-col gap-4">

            {/* STEP 1: Address */}
            {step === "address" && (
              <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
                <h2 className="mb-5 font-display text-lg text-cream">Shipping Address</h2>
                <AddressForm address={address} onChange={setAddress} errors={addressErrors} />
                <button
                  onClick={() => { if (validateAddress()) setStep("payment"); }}
                  className="mt-6 w-full rounded-sm bg-brass py-3 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight"
                >
                  Continue to Payment →
                </button>
              </div>
            )}

            {/* STEP 2: Payment */}
            {step === "payment" && (
              <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
                <h2 className="mb-5 font-display text-lg text-cream">Payment Method</h2>
                <PaymentSelector selected={selectedPayment} onSelect={(id) => { setSelectedPayment(id); setPaymentError(null); }} />
                {paymentError && <p className="mt-3 text-sm text-red-400">{paymentError}</p>}

                {/* COD info box */}
                {selectedPayment === "cod" && (
                  <div className="mt-4 rounded-sm border border-brass/20 bg-brass/5 px-4 py-3 text-sm text-brass/80">
                    💵 Pay in cash when your order is delivered. No advance payment required.
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep("address")}
                    className="flex-1 rounded-sm border border-white/10 py-3 text-sm text-slate transition hover:text-cream"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => { if (validatePayment()) setStep("review"); }}
                    className="flex-1 rounded-sm bg-brass py-3 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Review + Coupon */}
            {step === "review" && (
              <>
                {/* Items */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
                  <h2 className="mb-4 font-display text-lg text-cream">Review Items</h2>
                  <div className="flex flex-col divide-y divide-white/[0.06]">
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-4 py-3">
                        {item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded-sm border border-white/10 object-cover" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-cream">{item.name}</p>
                          <p className="text-xs text-slate">PKR {item.price.toFixed(2)} × {item.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold text-brass">
                          PKR {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coupon */}
                <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
                  <h2 className="mb-4 font-display text-lg text-cream">Coupon Code</h2>
                  {coupon ? (
                    <div className="flex items-center justify-between rounded-sm border border-brass/30 bg-brass/10 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-brass">{coupon.code}</p>
                        {coupon.description && <p className="text-xs text-slate">{coupon.description}</p>}
                        <p className="mt-0.5 text-xs text-emerald-400">Saves PKR {coupon.discountAmount.toFixed(2)}</p>
                      </div>
                      <button onClick={() => { setCoupon(null); setCouponInput(""); }} className="text-xs text-slate/60 hover:text-red-400 transition">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                        className="flex-1 rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm uppercase text-cream outline-none transition placeholder:normal-case placeholder:text-slate/50 focus:border-brass/50"
                      />
                      <button onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()} className="rounded-sm border border-brass/40 px-4 py-2 text-sm text-brass transition hover:bg-brass hover:text-ink disabled:opacity-40">
                        {couponLoading ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="mt-2 text-xs text-red-400">{couponError}</p>}
                </div>

                {/* Address + Payment summary */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate/60">Delivering To</p>
                      <button onClick={() => setStep("address")} className="text-xs text-brass hover:underline">Edit</button>
                    </div>
                    <div className="text-sm text-slate space-y-0.5">
                      <p className="text-cream font-medium">{address.fullName}</p>
                      <p>{address.phone}</p>
                      <p>{address.addressLine1}</p>
                      {address.addressLine2 && <p>{address.addressLine2}</p>}
                      <p>{address.city}, {address.state}</p>
                      <p>{address.country}</p>
                    </div>
                  </div>
                  <div className="rounded-sm border border-white/[0.08] bg-surface p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate/60">Payment</p>
                      <button onClick={() => setStep("payment")} className="text-xs text-brass hover:underline">Edit</button>
                    </div>
                    <p className="text-sm text-cream">{paymentMethodLabel}</p>
                    {selectedPayment === "cod" && (
                      <p className="mt-1 text-xs text-slate">Pay on delivery</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setStep("confirm")}
                  className="w-full rounded-sm bg-brass py-3 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight"
                >
                  Continue to Place Order →
                </button>
              </>
            )}

            {/* STEP 4: Confirm */}
            {step === "confirm" && (
              <div className="rounded-sm border border-white/[0.08] bg-surface p-6">
                <h2 className="mb-2 font-display text-lg text-cream">Place Your Order</h2>
                <p className="mb-6 text-sm text-slate leading-relaxed">
                  By clicking Place Order, you confirm your purchase.
                  {selectedPayment === "cod" && " Payment will be collected on delivery."}
                </p>

                {/* Final price */}
                <div className="mb-6 rounded-sm border border-white/[0.08] bg-ink/30 p-4">
                  <div className="flex justify-between text-sm text-slate mb-1">
                    <span>Subtotal</span><span>PKR {subtotal.toFixed(2)}</span>
                  </div>
                  {coupon && (
                    <div className="flex justify-between text-sm text-emerald-400 mb-1">
                      <span>Discount ({coupon.code})</span><span>-PKR {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate mb-1">
                    <span>Shipping</span><span className="text-emerald-400">Free</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate mb-1">
                    <span>Payment</span><span className="text-cream">{paymentMethodLabel}</span>
                  </div>
                  <div className="mt-2 border-t border-white/[0.08] pt-2 flex justify-between font-bold text-cream">
                    <span>Total</span><span>PKR {total.toFixed(2)}</span>
                  </div>
                </div>

                {orderError && (
                  <div className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {orderError}
                  </div>
                )}

                <button
                  onClick={placeOrder}
                  disabled={submitting}
                  className="w-full rounded-sm bg-brass py-3 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight disabled:opacity-50"
                >
                  {submitting ? "Placing Order…" : "✓ Place Order"}
                </button>
                <button
                  onClick={() => setStep("review")}
                  className="mt-3 w-full text-center text-sm text-slate transition hover:text-cream"
                >
                  ← Back to Review
                </button>
              </div>
            )}
          </div>

          {/* ── Right: order summary ── */}
          <div className="lg:sticky lg:top-4 h-fit">
            <OrderSummary items={items} subtotal={subtotal} coupon={coupon} />
          </div>
        </div>
      </main>
    </div>
  );
}
