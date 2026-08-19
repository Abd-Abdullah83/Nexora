"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="rounded-sm border border-white/10 px-3 py-1.5 text-sm text-slate transition hover:border-brass/40 hover:text-brass disabled:cursor-not-allowed disabled:opacity-30"
      >
        Previous
      </button>
      <span className="text-sm text-slate">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="rounded-sm border border-white/10 px-3 py-1.5 text-sm text-slate transition hover:border-brass/40 hover:text-brass disabled:cursor-not-allowed disabled:opacity-30"
      >
        Next
      </button>
    </div>
  );
}
