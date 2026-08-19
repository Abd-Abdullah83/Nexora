"use client";

import { useState } from "react";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/Button";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

export default function TwoFactorSetupPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setError(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || "Could not start 2FA setup.");
      return;
    }
    setQrCode(data.qrCodeDataUrl);
    setSecret(data.secret);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message || "Invalid code.");
      return;
    }
    setMessage("Two-factor authentication is now enabled on your account.");
    setTimeout(() => {
      window.location.href = "/admin/dashboard";
    }, 1500);
  }

  return (
    <AuthBackground>
      <AuthCard
        title="Set up two-factor authentication"
        subtitle="Required for all admin accounts."
      >
        {message && <SuccessMessage>{message}</SuccessMessage>}

        {!qrCode && !message && (
          <Button onClick={startSetup} type="button">
            Generate QR Code
          </Button>
        )}

        {qrCode && !message && (
          <div className="flex flex-col items-center gap-5">
            <div className="rounded-sm border border-white/10 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="Scan with your authenticator app" className="h-44 w-44" />
            </div>
            {secret && (
              <p className="text-center text-xs text-slate">
                Manual entry key: <span className="font-mono text-brass">{secret}</span>
              </p>
            )}
            <form onSubmit={confirmSetup} className="flex w-full flex-col gap-4">
              <InputField
                label="Enter 6-digit code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
              {error && <p className="text-sm text-red-300">{error}</p>}
              <Button>Confirm &amp; Enable</Button>
            </form>
          </div>
        )}
      </AuthCard>
    </AuthBackground>
  );
}
