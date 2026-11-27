"use client";

import type { ReactNode } from "react";

export function Stepper({
  label,
  hint,
  valueLabel,
  onDecrease,
  onIncrease,
  disableDecrease,
  disableIncrease,
  ariaLabel,
}: {
  label: string;
  hint?: string;
  valueLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  disableDecrease?: boolean;
  disableIncrease?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        {hint ? <span className="text-[10px] text-ink-faint">{hint}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disableDecrease}
          aria-label={`${ariaLabel} 줄이기`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-lg font-bold leading-none text-ink-2 shadow-sm transition active:scale-95 disabled:opacity-35"
        >
          −
        </button>
        <span className="tnum text-base font-extrabold text-ink">{valueLabel}</span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={disableIncrease}
          aria-label={`${ariaLabel} 늘리기`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-lg font-bold leading-none text-ink-2 shadow-sm transition active:scale-95 disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-2">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-brand" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function WonInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value > 0 ? value.toLocaleString("ko-KR") : ""}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 9);
          onChange(digits ? Number(digits) : 0);
        }}
        className="tnum w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-4 pr-10 text-right text-lg font-bold text-ink placeholder:text-base placeholder:font-normal placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
      />
      <span className="pointer-events-none absolute right-3.5 top-3.5 text-sm text-ink-muted">원</span>
    </div>
  );
}

export function NumericInput({
  value,
  onChange,
  placeholder,
  suffix,
  ariaLabel,
  max,
  step = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  placeholder?: string;
  suffix?: string;
  ariaLabel: string;
  max?: number;
  step?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value === 0 ? "" : String(value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const parsed = Number(raw);
          if (Number.isNaN(parsed)) return;
          onChange(Math.max(0, max ? Math.min(parsed, max) : parsed));
        }}
        className="tnum w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-4 pr-9 text-right text-sm font-bold text-ink placeholder:font-normal placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3.5 top-2.5 text-xs text-ink-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
