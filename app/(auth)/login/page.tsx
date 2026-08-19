"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/Button";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";
import { SuccessMessage } from "@/components/ui/SuccessMessage";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefilledEmail = searchParams.get("email");
    if (prefilledEmail) {
      setForm(function (prev) { return { ...prev, emailOrUsername: prefilledEmail }; });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loginSucceeded) return;
    const timer = setTimeout(function () {
      router.push(redirectTarget);
    }, 800);
    return function () { clearTimeout(timer); };
  }, [loginSucceeded, redirectTarget, router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setNoAccount(false);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.code === "AUTH_INVALID_CREDENTIALS") {
          setNoAccount(true);
        } else {
          setError((data.error && data.error.message) || "Login failed.");
        }
        return;
      }
      if (data.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        return;
      }
      let destination = "/";
      if (data.user && data.user.role === "admin") {
        destination = data.requiresTwoFactorSetup ? "/admin/2fa-setup" : "/admin/dashboard";
      }
      setRedirectTarget(destination);
      setLoginSucceeded(true);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.error && data.error.message) || "Invalid code.");
        return;
      }
      setRedirectTarget("/admin/dashboard");
      setLoginSucceeded(true);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loginSucceeded) {
    return (
      <AuthBackground>
        <AuthCard title="Login successful" subtitle="Taking you in now...">
          <SuccessMessage>You are logged in. Redirecting...</SuccessMessage>
        </AuthCard>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <AuthCard
        title={needsTwoFactor ? "Enter authenticator code" : "Welcome back"}
        subtitle={needsTwoFactor ? "Open your authenticator app to continue." : "Log in to continue shopping."}
      >
        {!needsTwoFactor ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <InputField
              label="Email or Username"
              type="text"
              name="emailOrUsername" value={form.emailOrUsername} onChange={handleChange} autoComplete="username email" />
            <InputField label="Password" type="password" name="password" value={form.password} onChange={handleChange} autoComplete="current-password" />
            {error && <p className="text-sm text-red-300">{error}</p>}
            {noAccount && (
              <div className="rounded-sm border border-brass/30 bg-brass/10 p-3 text-sm text-brass">
                We could not find a matching account, or the password was incorrect.{" "}
                <Link href="/register" className="font-semibold underline">Create an account</Link>{" "}
                if you are new here.
              </div>
            )}
            <Button disabled={loading}>{loading ? "Logging in..." : "Log In"}</Button>
          </form>
        ) : (
          <form onSubmit={handleTwoFactor} className="flex flex-col gap-5">
            <InputField label="6-digit code" name="code" value={totpCode} onChange={function (e) { setTotpCode(e.target.value); }} placeholder="123456" />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button disabled={loading}>{loading ? "Verifying..." : "Verify"}</Button>
          </form>
        )}
        <div className="mt-7 flex flex-col gap-2 text-center text-sm text-cream/70">
          <Link href="/forgot-password" className="text-brass hover:text-brassLight">Forgot password?</Link>
          <span>
            Do not have an account?{" "}
            <Link href="/register" className="font-medium text-brass hover:text-brassLight">Register</Link>
          </span>
        </div>
      </AuthCard>
    </AuthBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

