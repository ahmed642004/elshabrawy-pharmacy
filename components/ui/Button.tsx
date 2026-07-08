import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outlined" | "ghost" | "inverted";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  // Primary gets a light sweep on hover (pseudo-element, transform/opacity
  // only). The rtl: variants flip the physical translateX so the sweep always
  // travels from the reading-start edge.
  primary:
    "bg-primary-500 text-white shadow-[0_1px_2px_rgba(15,82,255,0.25)] hover:bg-primary-600 disabled:bg-primary-300 before:absolute before:inset-y-0 before:start-0 before:w-1/3 before:-skew-x-12 before:bg-white/20 before:opacity-0 before:transition-[transform,opacity] before:duration-700 before:-translate-x-[150%] hover:before:translate-x-[400%] hover:before:opacity-100 rtl:before:translate-x-[150%] rtl:hover:before:-translate-x-[400%] disabled:before:hidden",
  outlined:
    "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100",
  inverted: "bg-white text-primary-600 hover:bg-neutral-50 disabled:text-primary-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-[50px] px-5 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[10px] font-semibold font-body transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
