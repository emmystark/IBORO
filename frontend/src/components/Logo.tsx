"use client";

/**
 * Iboro mark: a closed ring with a single sealed notch and a solid cyan
 * center — "locked port", not a network node. Chip variant reproduces the
 * favicon lockup (graphite tile housing the mark); bare variant is the mark
 * on its own for use over dark surfaces.
 */
export function LogoMark({ size = 32, variant = "chip" }: { size?: number; variant?: "chip" | "bare" }) {
  const ring = (
    <svg width="100%" height="100%" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="40" fill="none" stroke="#f4f2ee" strokeWidth="9" />
      <rect x="55" y="14" width="10" height="20" fill={variant === "chip" ? "#1b1e24" : "#1b1e24"} />
      <circle cx="60" cy="60" r="11" fill="#3ddbd0" />
    </svg>
  );

  if (variant === "bare") {
    return <div style={{ width: size, height: size }}>{ring}</div>;
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-[7px] bg-[#1b1e24] flex items-center justify-center flex-shrink-0"
    >
      <div style={{ width: size * 0.62, height: size * 0.62 }}>{ring}</div>
    </div>
  );
}

export function Logo({
  size = 32,
  wordmark = true,
  className = "",
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {wordmark && (
        <span
          className="font-display font-bold tracking-[0.06em] text-[var(--ink)]"
          style={{ fontSize: size * 0.62 }}
        >
          IBORO
        </span>
      )}
    </div>
  );
}
