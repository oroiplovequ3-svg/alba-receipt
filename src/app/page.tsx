"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt } from "@/components/Receipt";
import { RealPayCheck } from "@/components/RealPayCheck";
import { Faq } from "@/components/Faq";
import { PartnerSlot } from "@/components/PartnerSlot";
import { NumericInput, Stepper, ToggleRow, WonInput } from "@/components/ui";
import {
  calcPay,
  calcWeeklyHours,
  MIN_WAGE_2026,
  MIN_WAGE_2027,
  WEEKS_PER_MONTH,
  won,
  type PayInput,
  type TaxType,
} from "@/lib/pay";
import { buildReceiptText } from "@/lib/receipt";
import { copyText } from "@/lib/clipboard";

const STORAGE_KEY = "alba-receipt:input:v1";

const DEFAULT_INPUT: PayInput = {
  hourlyWage: MIN_WAGE_2026,
  weeklyDays: 3,
  dailyHours: 6,
  breakMinutes: 30,
  useDirectHours: false,
  directWeeklyHours: 0,
  taxType: "freelancer",
  probation: false,
  fiveOrMoreEmployees: true,
  overtimeHours: 0,
  nightHours: 0,
};

const TAX_OPTIONS: { id: TaxType; label: string; rate: string; desc: string }[] = [
  { id: "freelancer", label: "3.3%", rate: "원천징수", desc: "프리랜서·사업소득" },
  { id: "insurance", label: "4대보험", rate: "9.7%", desc: "근로자 부담분" },
  { id: "none", label: "미적용", rate: "0%", desc: "공제 없음" },
];

const BREAK_PRESETS = [0, 30, 60];

function sanitize(raw: unknown): PayInput {
  if (!raw || typeof raw !== "object") return DEFAULT_INPUT;
  const src = raw as Record<string, unknown>;
  const num = (key: keyof PayInput, fallback: number) =>
    typeof src[key] === "number" && Number.isFinite(src[key] as number)
      ? (src[key] as number)
      : fallback;
  const bool = (key: keyof PayInput, fallback: boolean) =>
    typeof src[key] === "boolean" ? (src[key] as boolean) : fallback;
  const tax = src.taxType;

  return {
    hourlyWage: Math.max(0, num("hourlyWage", DEFAULT_INPUT.hourlyWage)),
    weeklyDays: Math.min(7, Math.max(1, num("weeklyDays", DEFAULT_INPUT.weeklyDays))),
    dailyHours: Math.min(24, Math.max(0.5, num("dailyHours", DEFAULT_INPUT.dailyHours))),
    breakMinutes: Math.min(600, Math.max(0, num("breakMinutes", DEFAULT_INPUT.breakMinutes))),
    useDirectHours: bool("useDirectHours", DEFAULT_INPUT.useDirectHours),
    directWeeklyHours: Math.min(168, Math.max(0, num("directWeeklyHours", DEFAULT_INPUT.directWeeklyHours))),
    taxType: tax === "freelancer" || tax === "insurance" || tax === "none" ? tax : "freelancer",
    probation: bool("probation", DEFAULT_INPUT.probation),
    fiveOrMoreEmployees: bool("fiveOrMoreEmployees", DEFAULT_INPUT.fiveOrMoreEmployees),
    overtimeHours: Math.min(168, Math.max(0, num("overtimeHours", 0))),
    nightHours: Math.min(168, Math.max(0, num("nightHours", 0))),
  };
}

export default function AlbaReceiptPage() {
  const [input, setInput] = useState<PayInput>(DEFAULT_INPUT);
  const [actualPayText, setActualPayText] = useState("");
  const [copied, setCopied] = useState(false);
  const loadedRef = useRef(false);

  const result = useMemo(() => calcPay(input), [input]);
  const actualPay = Number(actualPayText.replace(/[^0-9]/g, ""));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setInput(sanitize(JSON.parse(raw)));
    } catch {
      // 저장된 값이 없거나 깨졌으면 기본값을 쓴다
    }
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      // 저장 실패는 무시한다(사생활 보호 모드 등)
    }
  }, [input]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const update = <K extends keyof PayInput>(key: K, value: PayInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const handleCopyReceipt = async () => {
    const ok = await copyText(
      buildReceiptText(input, result, actualPayText.trim() !== "" && actualPay > 0 ? actualPay : null),
    );
    if (ok) setCopied(true);
  };

  const weeklyHoursLabel = Number.isInteger(result.weeklyHours)
    ? String(result.weeklyHours)
    : result.weeklyHours.toFixed(1);
  const belowMinimum = input.hourlyWage > 0 && input.hourlyWage < MIN_WAGE_2026;
  const showBreakWarning = !input.useDirectHours && input.dailyHours >= 4 && input.breakMinutes < 30;
  const showBreakStrongWarning =
    !input.useDirectHours && input.dailyHours >= 8 && input.breakMinutes < 60;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-14 pt-8">
      <header className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-white/80 px-3 py-1 text-[11px] font-bold text-brand-700 shadow-sm">
          2026 최저시급 {won(MIN_WAGE_2026)}원 반영
        </span>
        <h1 className="mt-3 flex items-center justify-center gap-1.5 text-[30px] font-extrabold tracking-tight text-ink">
          <span aria-hidden="true">🧾</span> 알바영수증
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          시급과 근무시간만 넣으면 주휴수당·4대보험까지 반영한
          <br />
          이번 달 예상 실수령액이 영수증으로 나와요.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {/* 입력 카드 */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold text-ink">1. 급여 조건 입력</h2>
            <button
              type="button"
              onClick={() => {
                setInput(DEFAULT_INPUT);
                setActualPayText("");
              }}
              className="text-[11px] font-semibold text-ink-faint underline decoration-slate-300 underline-offset-2 transition hover:text-ink-2"
            >
              초기화
            </button>
          </div>

          {/* 시급 */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="hourly-wage" className="text-sm font-bold text-ink-2">
                시급
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => update("hourlyWage", MIN_WAGE_2026)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                    input.hourlyWage === MIN_WAGE_2026
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-ink-muted hover:bg-slate-200"
                  }`}
                >
                  2026 · {won(MIN_WAGE_2026)}
                </button>
                <button
                  type="button"
                  onClick={() => update("hourlyWage", MIN_WAGE_2027)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                    input.hourlyWage === MIN_WAGE_2027
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-ink-muted hover:bg-slate-200"
                  }`}
                >
                  2027 · {won(MIN_WAGE_2027)}
                </button>
              </div>
            </div>

            <WonInput
              value={input.hourlyWage}
              onChange={(next) => update("hourlyWage", next)}
              ariaLabel="시급"
              placeholder={won(MIN_WAGE_2026)}
            />

            {belowMinimum ? (
              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700">
                2026년 최저임금 {won(MIN_WAGE_2026)}원보다 {won(MIN_WAGE_2026 - input.hourlyWage)}원
                낮아요. 최저임금 미달이면 1350에 상담할 수 있어요.
              </p>
            ) : null}
          </div>

          {/* 근무시간 */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-bold text-ink-2">근무 시간</span>
              <button
                type="button"
                onClick={() => {
                  if (input.useDirectHours) {
                    update("useDirectHours", false);
                    return;
                  }
                  setInput((prev) => ({
                    ...prev,
                    useDirectHours: true,
                    directWeeklyHours: calcWeeklyHours(prev),
                  }));
                }}
                className="text-[11px] font-semibold text-brand underline decoration-brand/30 underline-offset-2"
              >
                {input.useDirectHours ? "일수 × 시간으로 입력" : "주당 총 시간 직접입력"}
              </button>
            </div>

            {input.useDirectHours ? (
              <div>
                <NumericInput
                  value={input.directWeeklyHours}
                  onChange={(next) => update("directWeeklyHours", next)}
                  suffix="시간/주"
                  ariaLabel="주당 총 근무시간"
                  placeholder="예: 18"
                  max={168}
                  step={0.5}
                />
                <p className="mt-1.5 text-[10px] text-ink-faint">
                  휴게시간을 뺀 실제 근무시간을 넣어 주세요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Stepper
                  label="주 근무일수"
                  valueLabel={`${input.weeklyDays}일`}
                  ariaLabel="주 근무일수"
                  onDecrease={() => update("weeklyDays", Math.max(1, input.weeklyDays - 1))}
                  onIncrease={() => update("weeklyDays", Math.min(7, input.weeklyDays + 1))}
                  disableDecrease={input.weeklyDays <= 1}
                  disableIncrease={input.weeklyDays >= 7}
                />
                <Stepper
                  label="하루 근무시간"
                  valueLabel={`${input.dailyHours}시간`}
                  ariaLabel="하루 근무시간"
                  onDecrease={() =>
                    update("dailyHours", Math.max(0.5, Math.round((input.dailyHours - 0.5) * 2) / 2))
                  }
                  onIncrease={() =>
                    update("dailyHours", Math.min(24, Math.round((input.dailyHours + 0.5) * 2) / 2))
                  }
                  disableDecrease={input.dailyHours <= 0.5}
                  disableIncrease={input.dailyHours >= 24}
                />
              </div>
            )}
          </div>

          {/* 휴게시간 */}
          {!input.useDirectHours ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-2">하루 휴게시간 (무급)</span>
                <span className="text-[10px] text-ink-faint">근무시간에서 자동 제외</span>
              </div>
              <div className="flex items-center gap-1.5">
                {BREAK_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => update("breakMinutes", minutes)}
                    className={`flex-1 rounded-xl border py-2 text-[12px] font-bold transition ${
                      input.breakMinutes === minutes
                        ? "border-brand bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-slate-50 text-ink-muted hover:bg-slate-100"
                    }`}
                  >
                    {minutes === 0 ? "없음" : `${minutes}분`}
                  </button>
                ))}
                <div className="relative w-[86px] shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    step={10}
                    aria-label="휴게시간 직접 입력(분)"
                    placeholder="0"
                    value={
                      BREAK_PRESETS.includes(input.breakMinutes) || input.breakMinutes === 0
                        ? ""
                        : String(input.breakMinutes)
                    }
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      update("breakMinutes", Number.isFinite(value) ? Math.min(600, Math.max(0, value)) : 0);
                    }}
                    className={`tnum w-full rounded-xl border py-2 pl-2 pr-6 text-right text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-brand/25 ${
                      input.breakMinutes > 0 && !BREAK_PRESETS.includes(input.breakMinutes)
                        ? "border-brand bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-slate-50 text-ink"
                    }`}
                  />
                  <span className="pointer-events-none absolute right-1.5 top-2.5 text-[10px] text-ink-faint">
                    분
                  </span>
                </div>
              </div>

              {showBreakWarning ? (
                <p
                  className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    showBreakStrongWarning ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {showBreakStrongWarning
                    ? "8시간 이상 근무면 1시간 이상 휴게를 줘야 해요(근로기준법 제54조)."
                    : "4시간 이상 근무면 30분 이상 휴게를 줘야 해요(근로기준법 제54조)."}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 근무 요약 */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-3.5 py-2.5 text-white">
            <span className="text-[11px] text-slate-300">주 소정근로 / 월 환산</span>
            <span className="tnum text-[12px] font-bold">
              {weeklyHoursLabel}시간 · 월 {result.monthlyHours}시간
            </span>
          </div>

          {/* 세금/공제 */}
          <div className="mt-5">
            <span className="mb-1.5 block text-sm font-bold text-ink-2">세금 · 4대보험</span>
            <div className="grid grid-cols-3 gap-1.5">
              {TAX_OPTIONS.map((option) => {
                const active = input.taxType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => update("taxType", option.id)}
                    aria-pressed={active}
                    className={`rounded-xl border px-2 py-2 text-center transition ${
                      active
                        ? "border-brand bg-brand-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`block text-[12px] font-extrabold ${active ? "text-brand-700" : "text-ink-2"}`}>
                      {option.label}
                    </span>
                    <span className={`block text-[10px] ${active ? "text-brand-700" : "text-ink-faint"}`}>
                      {option.rate}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-tight text-ink-faint">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 토글 */}
          <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-1">
            <ToggleRow
              label="수습기간 (시급 90%)"
              description="1년 이상 계약 + 수습 시작 3개월 이내만 인정. 단순노무직은 제외돼요."
              checked={input.probation}
              onChange={(next) => update("probation", next)}
            />
            <ToggleRow
              label="5인 이상 사업장"
              description={
                input.fiveOrMoreEmployees
                  ? "연장·야간 근로에 50% 가산수당을 반영해요."
                  : "5인 미만은 연장·야간 가산 의무가 없어요. 최저임금·주휴수당은 그대로 적용돼요."
              }
              checked={input.fiveOrMoreEmployees}
              onChange={(next) => update("fiveOrMoreEmployees", next)}
            />
          </div>

          {/* 연장·야간 */}
          <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-bold text-ink-2 [&::-webkit-details-marker]:hidden">
              <span>
                연장 · 야간 근무 (선택)
                {input.overtimeHours > 0 || input.nightHours > 0 ? (
                  <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">
                    반영됨
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" className="text-ink-faint">
                ▾
              </span>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[11px] text-ink-muted">주 연장근로</span>
                <NumericInput
                  value={input.overtimeHours}
                  onChange={(next) => update("overtimeHours", next)}
                  suffix="h"
                  ariaLabel="주 연장근로시간"
                  placeholder="0"
                  max={168}
                  step={0.5}
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-ink-muted">주 야간근로</span>
                <NumericInput
                  value={input.nightHours}
                  onChange={(next) => update("nightHours", next)}
                  suffix="h"
                  ariaLabel="주 야간근로시간"
                  placeholder="0"
                  max={168}
                  step={0.5}
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
              야간은 22:00~06:00 근무 시간이에요. 근무 시간에 포함된 것으로 보고 가산분만 더해요.
              <br />
              {input.fiveOrMoreEmployees
                ? "5인 이상: 연장 50% · 야간 50% 가산(중복 시 100%)."
                : "5인 미만: 가산 없이 근무시간만큼의 시급을 반영해요."}
            </p>
          </details>
        </section>

        {/* 영수증 */}
        <Receipt input={input} result={result} />

        <button
          type="button"
          onClick={handleCopyReceipt}
          aria-live="polite"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[14px] font-bold text-white shadow-card transition active:scale-[0.99]"
        >
          {copied ? "✅ 영수증 복사 완료!" : "📋 내 알바비 영수증 복사하기"}
        </button>

        {/* 실제 입금액 비교 */}
        <RealPayCheck
          input={input}
          result={result}
          actualText={actualPayText}
          onActualTextChange={setActualPayText}
        />

        <PartnerSlot />

        {/* 계산 기준 */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-[15px] font-extrabold text-ink">계산 기준 (2026년)</h3>
          <dl className="mt-3 space-y-2 text-[12px]">
            {[
              ["최저시급", `${won(MIN_WAGE_2026)}원 · 월 209시간 ${won(MIN_WAGE_2026 * 209)}원`],
              ["2027년 최저시급", `${won(MIN_WAGE_2027)}원 · 월 ${won(MIN_WAGE_2027 * 209)}원`],
              ["주휴수당", "(주 소정근로 ÷ 40) × 8시간 × 시급 · 주 15시간 이상 · 소정근로일 개근 가정"],
              ["4대보험 근로자", "국민연금 4.75% + 건강보험 3.595% + 장기요양 13.14% + 고용보험 0.9% = 9.7%"],
              ["3.3% 원천징수", "소득세 3% + 지방소득세 0.3%"],
              ["월 환산", `1년 365일 ÷ 12개월 ÷ 7일 = ${WEEKS_PER_MONTH.toFixed(3)}주`],
              ["가산수당", "연장·야간 50% (5인 이상 사업장)"],
            ].map(([term, value]) => (
              <div key={term} className="flex gap-3 border-b border-dashed border-slate-100 pb-2 last:border-0 last:pb-0">
                <dt className="w-[86px] shrink-0 font-semibold text-ink-2">{term}</dt>
                <dd className="text-ink-muted">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
            4대보험 모드에는 근로소득세가 포함되지 않아요(근로소득 간이세액표에 따라 별도 공제).
            근로계약서와 급여명세서로 정확한 금액을 확인하세요.
          </p>
          <a
            href="https://labor.moel.go.kr/minwonSysInfo/minwagesys.do"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[10px] font-semibold text-brand underline decoration-brand/30 underline-offset-2"
          >
            고용노동부 노동포털 최저임금 안내 ↗
          </a>
        </section>

        <Faq />
      </div>

      <footer className="mt-8 space-y-1 text-center text-[10px] leading-relaxed text-ink-faint">
        <p>© 2026 알바영수증 · 참고용 계산기이며 법적 효력이 없습니다.</p>
        <p>실제 급여는 근로계약·사업장 규정에 따라 달라질 수 있어요.</p>
        <p className="text-ink-faint/80">입력한 값은 서버로 전송되지 않고 브라우저에만 저장돼요.</p>
      </footer>
    </main>
  );
}
