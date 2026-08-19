export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-surface/80 p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-10">
      {/* Brand mark */}
      <div className="mb-7 flex items-center justify-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass/40 text-xs font-display italic text-brass">
          N
        </span>
        <span className="font-display text-sm uppercase tracking-[0.2em] text-cream/70">
          Nexora
        </span>
      </div>

      {/* Signature: animated light sweep across a hairline */}
      <div className="relative mb-7 h-px w-full overflow-hidden bg-white/[0.08]">
        <div className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-brass to-transparent" />
      </div>

      <h1 className="font-display text-[1.65rem] leading-tight text-cream">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-cream/70">{subtitle}</p>}

      <div className="mt-7">{children}</div>
    </div>
  );
}
