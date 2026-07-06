import { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "primary" | "danger";
type Size = "sm" | "md";

const toneClasses: Record<Tone, string> = {
  neutral: "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50",
  primary: "bg-primary-500 text-white hover:bg-primary-600",
  danger: "border border-danger-50 bg-danger-50 text-danger-600 hover:bg-danger-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

const iconSizeClasses: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-[18px] w-[18px]",
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  tone?: Tone;
  size?: Size;
  shape?: "circle" | "square";
  "aria-label": string;
}

export default function IconButton({
  icon: Icon,
  tone = "neutral",
  size = "md",
  shape = "square",
  className = "",
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        shape === "circle" ? "rounded-full" : "rounded-[10px]"
      } ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      <Icon className={iconSizeClasses[size]} strokeWidth={2} />
    </button>
  );
}
