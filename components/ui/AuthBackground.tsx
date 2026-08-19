export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-12">
      {/* Quiet radial vignette, anchored top-center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 50% 0%, rgba(201,163,90,0.10), transparent 60%)",
        }}
      />

      {/* Fine architectural grid, barely visible */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,227,217,1) 1px, transparent 1px), linear-gradient(90deg, rgba(232,227,217,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Hairline frame around the whole viewport, like a printed plate */}
      <div className="pointer-events-none absolute inset-4 hidden rounded-sm border border-brass/10 sm:block md:inset-8" />

      <div className="relative z-10 w-full max-w-sm animate-rise">{children}</div>
    </main>
  );
}
