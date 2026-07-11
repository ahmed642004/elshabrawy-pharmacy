interface LogoProps {
  // Rendered size in px — the badge is always square.
  size: number;
  // Kept for call-site compatibility with the previous next/image version;
  // inline SVG has no network fetch to prioritize.
  priority?: boolean;
  className?: string;
}

// Single source for the pharmacy's badge mark ("Trust Shield": a shield
// carrying the pharmacy cross). Inlined as SVG rather than a raster asset —
// it's pure vector shapes in the brand palette (#0F52FF), so this stays crisp
// at every call-site size with no image request, optimizer round-trip, or CLS.
export default function Logo({ size, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Elshabrawy Pharmacy"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M50 10 L84 22 L84 50 C84 71 69 84 50 90 C31 84 16 71 16 50 L16 22 Z"
        fill="#0F52FF"
      />
      <rect x="44" y="34" width="12" height="32" rx="4" fill="#fff" />
      <rect x="34" y="44" width="32" height="12" rx="4" fill="#fff" />
    </svg>
  );
}
