"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/Button";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setAccountExists(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    setAccountExists(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === "AUTH_EMAIL_EXISTS") {
          setAccountExists(true);
          return;
        }
        if (data.error?.code === "AUTH_USERNAME_EXISTS") {
          setErrors({ username: "This username is already taken." });
          return;
        }
        if (data.error?.details?.fieldErrors) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, val] of Object.entries(data.error.details.fieldErrors)) {
            if (Array.isArray(val) && val[0]) fieldErrors[key] = val[0];
          }
          setErrors(fieldErrors);
        } else if (data.error?.details?.password) {
          setErrors({ password: data.error.details.password });
        } else {
          setErrors({ form: data.error?.message || "Something went wrong." });
        }
        return;
      }

      setMessage(data.message);
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard title="Create your account" subtitle="Join us and start shopping smarter.">
        {message ? (
          <div className="flex flex-col gap-3">
            <SuccessMessage>{message}</SuccessMessage>
            {process.env.NODE_ENV !== "production" && (
              <p className="rounded-sm border border-brass/30 bg-brass/5 p-3 text-xs leading-relaxed text-brass/90">
                Dev mode: check the terminal running <code>npm run dev</code> for a
                &ldquo;[DEV ONLY] Verification link&rdquo; — open that link to verify this account.
              </p>
            )}
          </div>
        ) : accountExists ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-sm border border-brass/30 bg-brass/10 p-3 text-sm text-brass">
              An account already exists with this email. Please log in instead.
            </p>
            <Button
              type="button"
              onClick={() => router.push(`/login?email=${encodeURIComponent(form.email)}`)}
            >
              Go to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <InputField
              label="Full Name"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              error={errors.fullName}
              autoComplete="name"
            />
            <InputField
              label="Username"
              name="username"
              value={form.username}
              onChange={handleChange}
              error={errors.username}
              autoComplete="username"
            />
            <InputField
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />
            <InputField
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="new-password"
            />
            {errors.form && <p className="text-sm text-red-300">{errors.form}</p>}
            <Button disabled={loading}>{loading ? "Creating account..." : "Register"}</Button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-slate">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brass hover:text-brassLight">
            Log in
          </Link>
        </p>
      </AuthCard>
    </AuthBackground>
  );
}
