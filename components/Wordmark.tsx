interface WordmarkProps {
  // Font-size-equivalent height in px — pass the same number you'd have used
  // for the Tailwind text size it replaces (e.g. text-xl -> 20, text-lg -> 18).
  size: number;
  className?: string;
}

// Static SVG rendering of the "Elshabrawy Pharmacy" wordmark.
// This text used to be live DOM text set in font-headline (a next/font
// Google font). It's also the largest text on most pages, so it was the LCP
// candidate — and the webfont request/swap was landing directly on that
// metric. Baking it as SVG with the system font stack removes the
// dependency entirely: no font request, no swap, nothing to block on.
export default function Wordmark({ size, className = "" }: WordmarkProps) {
  return (
    <svg
      height={size * 1.4}
      viewBox="0 0 1140 140"
      style={{ overflow: "visible" }}
      role="img"
      aria-label="Elshabrawy Pharmacy"
      className={className}
    >
      <text
        x="0"
        y="100"
        direction="ltr"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="800"
        fontSize="100"
        letterSpacing="-2.5"
      >
        <tspan fill="#0f172a">Elshabrawy </tspan>
        <tspan fill="#0f52ff">Pharmacy</tspan>
      </text>
    </svg>
  );
}
