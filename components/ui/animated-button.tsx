"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  glow?: boolean;
}

export function AnimatedButton({
  className,
  glow = true,
  children,
  ...props
}: AnimatedButtonProps) {
  return (
    <motion.button
      whileHover={{
        scale: 1.03,
        boxShadow: glow ? "0 0 30px rgba(56, 189, 248, 0.28)" : "0 0 0 rgba(0,0,0,0)"
      }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-sky-400/25 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-50 transition disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
