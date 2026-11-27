"use client";

import { won, type PayInput, type PayResult } from "@/lib/pay";
import { formatBreak } from "@/lib/receipt";

const TEETH =
  "M0 0 L5 10 L10 0 L15 10 L20 0 L25 10 L30 0 L35 10 L40 0 L45 10 L50 0 L55 10 L60 0 L65 10 L70 0 L75 10 L80 0 L85 10 L90 0 L95 10 L100 0 L105 10 L110 0 L115 10 L120 0 L125 10 L130 0 L135 10 L140 0 L145 10 L150 0 L155 10 L160 0 L165 10 L170 0 L175 10 L180 0 L185 10 L190 0 L195 10 L200 0 L205 10 L210 0 L215 10 L220 0 L225 10 L230 0 L235 10 L240 0 L245 10 L250 0 L255 10 L260 0 L265 10 L270 0 L275 10 L280 0 L285 10 L290 0 L295 10 L300 0 L305 10 L310 0 L315 10 L320 0 L325 10 L330 0 L335 10 L340 0 L345 10 L350 0 L355 10 L360 0 L365 10 L370 0 L375 10 L380 0 L385 10 L390 0 L395 10 L400 0 L400 10 L0 10 Z";

function Zigzag({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block h-[10px] w-full text-white ${flipped ? "-scale-y-100" : ""}`}
    >
      <path d={TEETH} fill="currentColor" />
    </svg>
  );
}

function Row({
  label,
  sub,
  value,
  valueClass = "text-ink",
  small,
}: {
  label: string;
  sub?: string;
  value: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`min-w-0 ${small ? "text-[11px] text-ink-muted" : "text-[13px] text-ink-2"}`}>
        {label}
        {sub ? <span className="ml-1 text-[10px] text-ink-faint">{sub}</span> : null}
      </span>
      <span className={`tnum shrink-0 font-semibold ${small ? "text-[11px]" : "text-[13px]"} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export function Receipt({ input, result }: { input: PayInput; result: PayResult }) {
  const now = new Date();
  const serial = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const taxLabel =
    input.taxType === "freelancer"
      ? "3.3% 원천징수"
      : input.taxType === "insurance"
        ? "4대보험 9.7%"
        : "공제 없음";

  const schedule = input.useDirectHours
    ? `주 ${won(input.directWeeklyHours)}시간(직접 입력)`
    : `주 ${input.weeklyDays}일 × 하루 ${input.dailyHours}시간 · ${formatBreak(input.breakMinutes)}`;

  return (
    <section aria-label="이번 달 예상 급여 영수증" className="relative">
      <Zigzag flipped />

      <div className="receipt-shadow border-x border-slate-200 bg-white px-5 pb-6 pt-5 font-mono">
        <div className="text-center">
          <h2 className="text-[19px] font-black tracking-[0.28em] text-ink">ALBA RECEIPT</h2>
          <p className="mt-1 text-[10px] tracking-widest text-ink-faint">NO. {serial}-PAY</p>
          <p className="mt-2 text-[11px] text-ink-muted">이번 달 예상 급여 명세서</p>
        </div>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <div className="space-y-1.5">
          <Row label="시급" sub={result.probationApplied ? "(수습 90%)" : undefined} value={`${won(result.effectiveWage)}원`} />
          <Row label="근무" value={schedule} />
          <Row
            label="주 소정근로"
            value={`${result.weeklyHours}시간 (월 ${result.monthlyHours}시간)`}
          />
          <Row label="공제 방식" value={taxLabel} />
        </div>

        <div className="my-4 flex justify-center">
          {result.holidayEligible ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              ✅ 주 15시간 이상 · 주휴수당 지급 대상
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
              ⚠️ 주 15시간 미만 · 주휴수당 없음
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Row
            label={`기본급`}
            sub={`${result.monthlyBaseHours}h`}
            value={`${won(result.monthlyBase)}원`}
          />
          <Row
            label="주휴수당"
            sub={result.holidayEligible ? `${result.monthlyHolidayHours}h` : "미해당"}
            value={result.holidayEligible ? `+${won(result.monthlyHoliday)}원` : "0원"}
            valueClass={result.holidayEligible ? "text-brand" : "text-ink-faint"}
          />
          {result.monthlyOvertime > 0 ? (
            <Row
              label="연장수당"
              sub={`${result.monthlyOvertimeHours}h × ${result.overtimeMultiplier}배`}
              value={`+${won(result.monthlyOvertime)}원`}
            />
          ) : null}
          {result.monthlyNight > 0 ? (
            <Row
              label="야간가산"
              sub={`${result.monthlyNightHours}h × ${result.nightPremiumMultiplier}배`}
              value={`+${won(result.monthlyNight)}원`}
            />
          ) : null}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />

        <div className="space-y-1.5">
          <Row label="세전 급여 합계" value={`${won(result.gross)}원`} valueClass="font-bold text-ink" />
          {result.deductions.map((line) => (
            <Row
              key={line.key}
              label={line.label}
              value={`-${won(line.amount)}원`}
              valueClass="text-rose-500"
              small
            />
          ))}
          {result.deductions.length > 0 ? (
            <Row
              label="공제 합계"
              value={`-${won(result.totalDeduction)}원`}
              valueClass="text-rose-500"
            />
          ) : (
            <Row label="공제" value="0원 (미적용)" valueClass="text-ink-muted" />
          )}
        </div>

        <div className="mt-4 border-t-2 border-ink pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink-faint">Estimated Net Pay</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-ink">이번 달 예상 실수령액</p>
            </div>
            <p className="tnum shrink-0 text-right text-[26px] font-black leading-none text-brand">
              {won(result.net)}
              <span className="ml-0.5 text-sm font-bold text-ink">원</span>
            </p>
          </div>
          <p className="mt-2 text-right text-[10px] text-ink-faint">
            실질 시급 약 {won(result.hourlyNet)}원
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[9px] leading-relaxed text-ink-faint">
            2026년 요율 기준 · 예상치이며
            <br />
            실제 급여와 다를 수 있습니다
          </p>
          <div
            aria-hidden="true"
            className="h-8 w-28 opacity-70"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#0f172a 0 2px,transparent 2px 5px,#0f172a 5px 6px,transparent 6px 10px,#0f172a 10px 13px,transparent 13px 15px)",
            }}
          />
        </div>
      </div>

      <Zigzag />
    </section>
  );
}
