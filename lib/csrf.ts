// lib/csrf.ts
export function getCsrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

// Use it in any fetch:
// fetch("/api/cart", {
//   method: "POST",
//   headers: { "x-csrf-token": getCsrfToken(), "Content-Type": "application/json" },
//   body: JSON.stringify(data),
// });