"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import type { MatrixCaptionRecord } from "@/lib/matrix/types";

export function ResultsTable({
  captions
}: {
  captions: MatrixCaptionRecord[];
}) {
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(captions.length / pageSize));
  const pageItems = useMemo(
    () => captions.slice((page - 1) * pageSize, page * pageSize),
    [captions, page]
  );

  return (
    <div className="glass-panel rounded-[1.75rem] border border-slate-800 bg-slate-950/55 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-sky-400">Results Table</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-100">Recent caption history</h3>
        </div>
        <div className="flex items-center gap-2">
          <AnimatedButton
            glow={false}
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </AnimatedButton>
          <span className="text-sm text-slate-400">
            Page {page} / {totalPages}
          </span>
          <AnimatedButton
            glow={false}
            disabled={page === totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </AnimatedButton>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-800">
        <div className="hidden grid-cols-[1.2fr,1fr,1fr,120px] bg-slate-950/70 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Caption</span>
          <span>Image</span>
          <span>Flavor</span>
          <span>Seconds</span>
        </div>
        <div>
          {pageItems.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="border-t border-slate-800/80 px-4 py-4 text-sm text-slate-200 md:grid md:grid-cols-[1.2fr,1fr,1fr,120px] md:gap-3"
            >
              <div className="md:hidden">
                <p className="line-clamp-3">{entry.caption}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{entry.imageTitle ?? entry.imageId}</span>
                  <span>{entry.flavorName ?? entry.flavorId}</span>
                  <span>{entry.processingTimeSeconds?.toFixed(2) ?? "-"}s</span>
                </div>
              </div>
              <span className="hidden line-clamp-2 md:block">{entry.caption}</span>
              <span className="hidden text-slate-400 md:block">{entry.imageTitle ?? entry.imageId}</span>
              <span className="hidden text-slate-400 md:block">{entry.flavorName ?? entry.flavorId}</span>
              <span className="hidden text-slate-400 md:block">
                {entry.processingTimeSeconds?.toFixed(2) ?? "-"}
              </span>
            </motion.div>
          ))}
          {pageItems.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-500">No captions yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
