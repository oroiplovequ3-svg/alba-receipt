"use client";

import { useEffect, useState } from "react";
import { compareRealPay, won, type PayInput, type PayResult } from "@/lib/pay";
import { buildCheckMessage } from "@/lib/receipt";
import { copyText } from "@/lib/clipboard";

export function RealPayCheck({
  input,
  result,
  actualText,
  onActualTextChange,
}: {
  input: PayInput;
  result: PayResult;
  actualText: string;
  onActualTextChange: (next: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const actual = Number(actualText.replace(/[^0-9]/g, ""));
  const hasActual = actualText.trim() !== "" && actual > 0;
  const comparison = hasActual ? compareRealPay(result.net, actual) : null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopyMessage = async () => {
    const ok = await copyText(buildCheckMessage(input, result, actual));
    if (ok) setCopied(true);
  };

  const banner =
    comparison &&
    (comparison.status === "short"
      ? {
          wrap: "border-rose-200 bg-rose-50",
          title: "text-rose-700",
          label: `예상보다 ${won(comparison.gap)}원 덜 받았어요`,
          emoji: "😮",
          sub: `예상 실수령액의 ${comparison.ratio.toFixed(1)}% · 확인이 필요해요`,
        }
      : comparison.status === "over"
        ? {
            wrap: "border-brand-100 bg-brand-50",
            title: "text-brand-700",
            label: `예상보다 ${won(comparison.gap)}원 더 받았어요`,
            emoji: "🎉",
            sub: "가산수당이나 정산이 더해졌을 수 있어요",
          }
        : {
            wrap: "border-emerald-200 bg-emerald-50",
            title: "text-emerald-700",
            label: "예상 금액과 정확히 일치해요",
            emoji: "✅",
            sub: "주휴수당·공제가 제대로 반영된 것 같아요",
          });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg">
          💸
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-ink">실제 입금액과 비교</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
            통장에 찍힌 금액을 넣으면 덜 받은 돈을 찾아드려요.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="actual-pay" className="mb-1.5 block text-xs font-semibold text-ink-2">
          실제 통장에 받은 금액
        </label>
        <div className="relative">
          <input
            id="actual-pay"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`예: ${won(result.net)}`}
            value={actualText}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 12);
              onActualTextChange(digits ? Number(digits).toLocaleString("ko-KR") : "");
            }}
            className="tnum w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-4 pr-10 text-right text-lg font-bold text-ink placeholder:text-sm placeholder:font-normal placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          <span className="pointer-events-none absolute right-4 top-3.5 text-sm text-ink-muted">원</span>
        </div>
      </div>

      {banner ? (
        <div className={`mt-3 animate-rise rounded-2xl border p-4 ${banner.wrap}`}>
          <p className={`flex items-center gap-1.5 text-sm font-extrabold ${banner.title}`}>
            <span aria-hidden="true">{banner.emoji}</span>
            {banner.label}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">{banner.sub}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <p className="text-ink-faint">예상 실수령액</p>
              <p className="tnum mt-0.5 text-[13px] font-bold text-ink">{won(result.net)}원</p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <p className="text-ink-faint">실제 입금액</p>
              <p className="tnum mt-0.5 text-[13px] font-bold text-ink">{won(actual)}원</p>
            </div>
          </div>
        </div>
      ) : null}

      {comparison?.status === "short" ? (
        <button
          type="button"
          onClick={handleCopyMessage}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-3 text-[13px] font-bold text-rose-600 transition active:scale-[0.99]"
        >
          {copied ? "✅ 메시지 복사 완료!" : "📩 사장님께 보낼 확인 메시지 복사"}
        </button>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
        급여명세서(근로기준법 제48조)를 요청하면 공제 내역을 정확히 확인할 수 있어요. 차이가 계속되면
        고용노동부 1350 상담을 권해요.
      </p>
    </section>
  );
}
