"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MonitorCog, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

const options = [
  { label: "Light", value: "light", icon: SunMedium },
  { label: "Dark", value: "dark", icon: MoonStar },
  { label: "System", value: "system", icon: MonitorCog }
] as const;

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="glass-panel flex items-center gap-2 rounded-full p-1.5">
      {options.map((option) => {
        const active =
          mounted &&
          (theme === option.value || (option.value === "system" && theme === "system"));
        const Icon = option.icon;

        return (
          <motion.button
            key={option.value}
            whileHover={{ scale: 1.04, boxShadow: "0 0 24px rgba(56, 189, 248, 0.25)" }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
              active
                ? "text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            <AnimatePresence>
              {active ? (
                <motion.span
                  layoutId="theme-pill"
                  className="absolute inset-0 rounded-full bg-sky-500/70"
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                />
              ) : null}
            </AnimatePresence>
            <span className="relative z-10 inline-flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {option.label}
            </span>
          </motion.button>
        );
      })}
      <span className="hidden text-xs text-slate-400 dark:text-slate-500 md:inline">
        Active:{" "}
        {mounted ? (theme === "system" ? `System (${resolvedTheme ?? "..."})` : theme) : "..."}
      </span>
    </div>
  );
}
