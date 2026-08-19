interface ButtonProps {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export function Button({
  children,
  type = "submit",
  disabled,
  onClick,
  variant = "primary",
}: ButtonProps) {
  if (variant === "secondary") {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className="w-full rounded-sm border border-brass/40 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-wider text-brass transition hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-sm bg-brass px-4 py-3 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-brassLight disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
