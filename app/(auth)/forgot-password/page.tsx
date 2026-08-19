"use client";

import { useState } from "react";
import Link from "next/link";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/Button";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Something went wrong.");
        return;
      }

      setMessage(data.message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard title="Forgot password" subtitle="We'll email you a link to reset it.">
        {message ? (
          <div className="flex flex-col gap-3">
            <SuccessMessage>{message}</SuccessMessage>
            {process.env.NODE_ENV !== "production" && (
              <p className="rounded-sm border border-brass/30 bg-brass/5 p-3 text-xs leading-relaxed text-brass/90">
                Dev mode: check the terminal running <code>npm run dev</code> for a
                &ldquo;[DEV ONLY] Password reset link&rdquo; — open that link to continue.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <InputField
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-slate">
          <Link href="/login" className="font-medium text-brass hover:text-brassLight">
            Back to login
          </Link>
        </p>
      </AuthCard>
    </AuthBackground>
  );
}
