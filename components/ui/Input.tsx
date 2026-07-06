import { InputHTMLAttributes } from "react";

export default function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-[46px] w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-3 focus:ring-primary-500/20 ${className}`}
      {...rest}
    />
  );
}
