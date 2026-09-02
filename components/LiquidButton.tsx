"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export type LiquidButtonVariant =
  | "primary"
  | "cobalt"
  | "glass"
  | "glass-subtle"
  | "pill"
  | "danger"
  | "fab";

export type LiquidButtonSize = "sm" | "md" | "lg" | "icon" | "icon-lg";

interface LiquidButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
  variant?: LiquidButtonVariant;
  size?: LiquidButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  active?: boolean;
  className?: string;
}

export default function LiquidButton({
  variant = "glass",
  size = "md",
  icon,
  children,
  active = false,
  className = "",
  disabled = false,
  ...props
}: LiquidButtonProps) {
  // Base styling for Liquid Glass buttons
  let variantStyles = "";
  let sizeStyles = "";

  switch (variant) {
    case "primary":
      variantStyles =
        "bg-gradient-to-br from-emerald-400 via-[#10B981] to-teal-600 text-[#021811] font-extrabold border border-white/60 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.85),0_12px_28px_rgba(16,185,129,0.38)]";
      break;
    case "cobalt":
      variantStyles =
        "bg-gradient-to-br from-blue-400 via-[#2563EB] to-indigo-700 text-white font-extrabold border border-white/60 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.85),0_12px_28px_rgba(37,99,235,0.38)]";
      break;
    case "glass":
      variantStyles = active
        ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-extrabold border border-white/70 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(16,185,129,0.35)]"
        : "bg-gradient-to-br from-white/14 via-white/6 to-transparent text-[var(--text)] font-semibold backdrop-blur-2xl border border-[var(--border-glass)] shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.55),inset_0_-1px_1px_rgba(0,0,0,0.2),0_10px_25px_rgba(0,0,0,0.3)] hover:bg-white/20";
      break;
    case "glass-subtle":
      variantStyles = active
        ? "bg-white/25 text-[var(--accent)] font-bold border border-[var(--accent)] shadow-[0_4px_16px_var(--accent-soft)]"
        : "bg-white/5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/12 border border-white/10";
      break;
    case "pill":
      variantStyles = active
        ? "bg-white text-black font-extrabold shadow-[0_8px_20px_rgba(255,255,255,0.25)] border border-white"
        : "bg-white/8 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/15 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]";
      break;
    case "danger":
      variantStyles =
        "bg-gradient-to-br from-rose-500/80 to-red-600/80 text-white font-bold border border-white/30 shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.6),0_8px_20px_rgba(239,68,68,0.3)]";
      break;
    case "fab":
      variantStyles =
        "bg-gradient-to-br from-emerald-400 via-[#10B981] to-teal-600 text-black font-black border border-white/70 shadow-[inset_0_2px_2px_rgba(255,255,255,0.9),0_16px_36px_rgba(16,185,129,0.45)]";
      break;
  }

  switch (size) {
    case "sm":
      sizeStyles = "px-3.5 py-1.5 text-xs rounded-full min-h-[36px] gap-1.5";
      break;
    case "md":
      sizeStyles = "px-5 py-3 text-sm rounded-full min-h-[46px] gap-2";
      break;
    case "lg":
      sizeStyles = "px-6 py-4 text-base rounded-full min-h-[56px] gap-2.5";
      break;
    case "icon":
      sizeStyles = "w-11 h-11 p-0 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center";
      break;
    case "icon-lg":
      sizeStyles = "w-14 h-14 p-0 rounded-full min-w-[56px] min-h-[56px] flex items-center justify-center";
      break;
  }

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center select-none overflow-hidden transition-colors ${variantStyles} ${sizeStyles} ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
      {...props}
    >
      {/* Specular reflection gloss top highlight */}
      <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/25 via-white/5 to-transparent rounded-t-full pointer-events-none" />

      {icon && <span className="flex-shrink-0 relative z-10">{icon}</span>}
      {children && <span className="relative z-10 truncate leading-none">{children}</span>}
    </motion.button>
  );
}
