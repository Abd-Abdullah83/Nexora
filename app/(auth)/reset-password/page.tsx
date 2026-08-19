"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/Button";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error?.details?.password || data.error?.message || "Reset failed."
        );
        return;
      }

      setMessage(data.message);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard title="Reset your password" subtitle="Choose a new, strong password.">
        {message ? (
          <SuccessMessage>{message}</SuccessMessage>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <InputField
              label="New Password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</Button>
          </form>
        )}
      </AuthCard>
    </AuthBackground>
  );
}
