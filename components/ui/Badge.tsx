import { ReactNode } from "react";

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral";
type Variant = "soft" | "solid";

const softClasses: Record<BadgeTone, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-neutral-100 text-neutral-600",
};

const solidClasses: Record<BadgeTone, string> = {
  primary: "bg-primary-500 text-white",
  success: "bg-success-500 text-white",
  warning: "bg-warning-500 text-white",
  danger: "bg-danger-500 text-white",
  neutral: "bg-neutral-500 text-white",
};

interface BadgeProps {
  tone?: BadgeTone;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export default function Badge({ tone = "neutral", variant = "soft", className = "", children }: BadgeProps) {
  const toneClasses = variant === "solid" ? solidClasses[tone] : softClasses[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${toneClasses} ${className}`}
    >
      {children}
    </span>
  );
}
