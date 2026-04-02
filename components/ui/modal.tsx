"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="glass-panel relative w-full max-w-2xl rounded-[2rem] p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 p-2 text-slate-500 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
