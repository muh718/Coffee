"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

    const variants = {
      primary:
        "gradient-brand text-[#20120b] font-bold shadow-md hover:shadow-lg hover:shadow-[#f5e2b3]/25 focus-visible:outline-[#f5e2b3]",
      secondary:
        "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-primary)] focus-visible:outline-brand-500",
      ghost:
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-brand-500",
      danger:
        "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 focus-visible:outline-red-500",
      outline:
        "border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-brand-500",
    };

    const sizes = {
      sm: "text-sm px-3 py-1.5 rounded-lg",
      md: "text-sm px-4 py-2.5",
      lg: "text-base px-6 py-3",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
