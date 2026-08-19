"use client";

import { useEffect, useState, useCallback } from "react";

interface RequirementGroupStatus {
  key: string;
  label: string;
  satisfied: boolean;
  verified: boolean;
  rejected: boolean;
}

interface DocRecord {
  docType: string;
  status: string;
  rejectionReason: string | null;
}

interface StatusResponse {
  seller: {
    sellerStatus: string;
    requirements: { groups: RequirementGroupStatus[]; allSubmitted: boolean; allVerified: boolean };
    documents: DocRecord[];
  } | null;
}

// Mirrors lib/sellers/verification.service.ts's REQUIREMENTS — kept in
// sync manually since this is a client component and can't import a
// server-only service file. If you change the requirements there, update
// this too.
const GROUP_DOC_OPTIONS: Record<string, { value: string; label: string; needsNumber: boolean }[]> = {
  personal_id: [
    { value: "national_id", label: "National ID", needsNumber: true },
    { value: "passport", label: "Passport", needsNumber: true },
  ],
  business_registration: [{ value: "business_registration", label: "Business Registration Certificate", needsNumber: true }],
  trade_license: [{ value: "trade_license", label: "Trade License", needsNumber: false }],
  tax_certificate: [{ value: "tax_certificate", label: "Tax Certificate", needsNumber: true }],
};

function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

export default function SellerVerifyKycContent() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sellers/verifications/status")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Could not load your verification status.");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="h-6 w-64 animate-pulse rounded bg-ivoryDark" />
        <div className="mt-6 h-40 animate-pulse rounded-sm bg-ivoryDark" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data?.seller) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-muted">No seller application found.</p>
      </div>
    );
  }

  const { requirements, documents, sellerStatus } = data.seller;

  if (sellerStatus !== "pending_kyc" && sellerStatus !== "pending_approval") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-xl text-charcoal">Identity verification</h1>
        <p className="mt-2 text-sm text-muted">
          This step isn't currently open for your application — check your{" "}
          <a href="/seller/status" className="text-gold underline hover:text-goldDark">status page</a> for what's next.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl text-charcoal">Identity Verification</h1>
      <p className="mt-2 text-sm text-muted">
        Upload the documents below. We manually review every submission — most are reviewed within 2–3 business days.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        {requirements.groups.map((group) => {
          const doc = documents.find((d) =>
            GROUP_DOC_OPTIONS[group.key]?.some((opt) => opt.value === d.docType)
          );
          return (
            <DocUploadCard
              key={group.key}
              group={group}
              options={GROUP_DOC_OPTIONS[group.key] ?? []}
              existingDoc={doc}
              onUploaded={load}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocUploadCard({
  group,
  options,
  existingDoc,
  onUploaded,
}: {
  group: RequirementGroupStatus;
  options: { value: string; label: string; needsNumber: boolean }[];
  existingDoc?: DocRecord;
  onUploaded: () => void;
}) {
  const [docType, setDocType] = useState(existingDoc?.docType ?? options[0]?.value ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [identityNumber, setIdentityNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedOption = options.find((o) => o.value === docType);
  const locked = group.verified; // verified docs can't be re-uploaded

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!file) {
      setLocalError("Choose a file first.");
      return;
    }
    if (selectedOption?.needsNumber && !identityNumber.trim()) {
      setLocalError("Enter the document number.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    if (identityNumber.trim()) formData.append("identityNumber", identityNumber.trim());

    try {
      const res = await fetch("/api/sellers/verifications", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setLocalError(json.error?.message ?? json.error?.details?.file ?? "Upload failed.");
        return;
      }
      setFile(null);
      onUploaded();
    } catch {
      setLocalError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-sm border border-ivoryBorder bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="font-medium text-charcoal">{group.label}</p>
        <StatusBadge group={group} />
      </div>

      {existingDoc?.rejectionReason && (
        <p className="mt-2 rounded-sm border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {existingDoc.rejectionReason}
        </p>
      )}

      {!locked && (
        <form onSubmit={handleUpload} className="mt-4 flex flex-col gap-3">
          {options.length > 1 && (
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-sm border border-ivoryBorder px-3 py-2 text-sm text-charcoal outline-none focus:border-gold"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {selectedOption?.needsNumber && (
            <input
              type="text"
              value={identityNumber}
              onChange={(e) => setIdentityNumber(e.target.value)}
              placeholder={`${selectedOption.label} number`}
              className="rounded-sm border border-ivoryBorder px-3.5 py-2.5 text-sm text-charcoal outline-none placeholder:text-subtle focus:border-gold focus:ring-1 focus:ring-gold/20"
            />
          )}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted"
          />

          {localError && <p className="text-xs text-red-600">{localError}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="self-start rounded-sm bg-charcoal px-5 py-2 text-sm font-semibold text-white transition hover:bg-gold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : existingDoc ? "Re-upload" : "Upload"}
          </button>
        </form>
      )}
    </div>
  );
}

function StatusBadge({ group }: { group: RequirementGroupStatus }) {
  if (group.verified) {
    return <span className="rounded-sm bg-emerald/15 px-2 py-0.5 text-xs font-medium text-emerald">Verified</span>;
  }
  if (group.rejected) {
    return <span className="rounded-sm bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Needs re-upload</span>;
  }
  if (group.satisfied) {
    return <span className="rounded-sm bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">Submitted — under review</span>;
  }
  return <span className="rounded-sm bg-ivoryDark px-2 py-0.5 text-xs font-medium text-subtle">Not submitted</span>;
}
