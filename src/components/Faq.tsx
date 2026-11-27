"use client";

import { FAQ_ITEMS } from "@/lib/faq";

export function Faq() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-sm">📌</span>
        <h3 className="text-[15px] font-extrabold text-ink">알바 급여 자주 묻는 질문</h3>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        {FAQ_ITEMS.map((item, index) => (
          <details key={item.q} className="group py-3" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-start gap-2 text-[13px] font-bold leading-relaxed text-ink-2 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 shrink-0 text-[11px] font-black text-brand">Q</span>
              <span className="flex-1">{item.q}</span>
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-xs text-ink-faint transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <p className="mt-2 pl-5 text-[12px] leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
