import Image from "next/image";
import logoSrc from "@/public/elshabrawy_pharmacy_logo.jpg";

interface LogoProps {
  // Rendered size in px — the badge is always square.
  size: number;
  // Set on the single above-the-fold instance per page (the header logo,
  // or the lone mark on the auth pages) so Next preloads it as an LCP
  // candidate instead of lazy-loading it.
  priority?: boolean;
  className?: string;
}

// Single source for the pharmacy's badge mark. Every call site previously
// duplicated a Lucide <Plus> icon inside a hand-styled rounded box.
// Static-importing the logo lets next/image read its intrinsic size instead
// of us guessing dimensions, and centralizes the asset so a future logo
// swap is a one-file change instead of six.
export default function Logo({ size, priority = false, className = "" }: LogoProps) {
  return (
    <Image
      src={logoSrc}
      alt="Elshabrawy Pharmacy"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 rounded-[10px] shadow-[0_6px_18px_rgba(15,82,255,0.28)] ${className}`}
    />
  );
}
