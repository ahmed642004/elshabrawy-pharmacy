// Shimmer sweep instead of a plain pulse — the ::after animation lives in
// globals.css (.cc-skeleton) since pseudo-elements can't take inline style.
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`cc-skeleton relative overflow-hidden rounded-[10px] bg-neutral-200/70 after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent after:content-[''] ${className}`}
    />
  );
}
