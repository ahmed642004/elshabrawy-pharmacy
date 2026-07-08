import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export default function Card({ children, padding = true, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[20px] border border-neutral-200 bg-white shadow-sm transition-shadow duration-200 ${padding ? "p-5" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
