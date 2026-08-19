"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthBackground } from "@/components/ui/AuthBackground";
import { AuthCard } from "@/components/ui/AuthCard";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          // Token genuinely doesn't exist, or exists but is unverified and expired.
          setStatus("error");
          setMessage(
            data.error?.message ||
              "This verification link is invalid or has expired. Please register again or request a new link."
          );
          return;
        }

        if (data.alreadyVerified) {
          setStatus("already");
          setMessage(data.message);
          return;
        }

        setStatus("success");
        setMessage(data.message);
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  return (
    <AuthBackground>
      <AuthCard title="Email verification">
        <div className="text-center">
          {status === "loading" && <p className="text-slate">Verifying your email...</p>}

          {status === "success" && (
            <>
              <p className="mb-5 text-sm" style={{ color: "#A7F3D0" }}>{message}</p>
              <Link href="/login" className="font-medium text-brass hover:text-brassLight">
                Continue to Log In
              </Link>
            </>
          )}

          {status === "already" && (
            <>
              <p className="mb-5 text-brass/90">{message}</p>
              <Link href="/login" className="font-medium text-brass hover:text-brassLight">
                Go to Login
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <p className="mb-5 text-red-300">{message}</p>
              <Link href="/register" className="font-medium text-brass hover:text-brassLight">
                Register again
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </AuthBackground>
  );
}
