"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CALENDAR_HOURS,
  WEEKDAY_LABEL,
  WEEKDAY_LONG,
  WEEKDAY_ORDER,
  hoursText,
  shiftMonth,
  withOverrides,
  type CalendarDay,
  type CalendarPayResult,
  type CalendarState,
  type DayOverride,
  type Weekday,
} from "@/lib/calendar";
import { won } from "@/lib/pay";
import { NumericInput } from "@/components/ui";

const BREAK_PRESETS = [0, 30, 60];

function MiniSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-brand" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function CalendarPanel({
  state,
  onChange,
  result,
  wage,
}: {
  state: CalendarState;
  onChange: (next: CalendarState) => void;
  result: CalendarPayResult;
  wage: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const monthOverrides = state.months[`${state.year}-${String(state.month).padStart(2, "0")}`] ?? {};
  const overrideCount = Object.keys(monthOverrides).length;

  useEffect(() => {
    setSelected(null);
  }, [state.year, state.month]);

  const monthWeeks = result.weeks.filter((week) => week.inMonthDays.length > 0);
  const allDays = result.weeks.flatMap((week) => week.days);
  const selectedDay = selected ? allDays.find((day) => day.key === selected) ?? null : null;

  const moveMonth = (delta: number) => {
    const next = shiftMonth(state.year, state.month, delta);
    onChange({ ...state, ...next });
  };

  const updateRule = (weekday: Weekday, patch: Partial<{ work: boolean; hours: number }>) => {
    const rules = state.rules.map((rule, index) =>
      index === weekday ? { ...rule, ...patch } : rule,
    );
    onChange({ ...state, rules });
  };

  const setOverride = (day: CalendarDay, override: DayOverride | null) => {
    const next = { ...monthOverrides };
    if (override) next[day.key] = override;
    else delete next[day.key];
    onChange(withOverrides(state, next));
  };

  const defaultWorkHours = () => {
    const rule =
      state.rules.find((item) => item.work && item.hours > 0) ?? {
        work: true,
        hours: DEFAULT_CALENDAR_HOURS,
      };
    const real = state.hoursIncludeBreak
      ? Math.max(0, rule.hours - state.breakMinutes / 60)
      : rule.hours;
    return Math.max(0.5, Math.round(real * 2) / 2);
  };

  const openWork = (day: CalendarDay) => {
    if (day.state === "work") return;
    setOverride(day, { status: "work", hours: defaultWorkHours(), overtimeHours: 0, nightHours: 0 });
  };

  const patchWork = (day: CalendarDay, patch: Partial<DayOverride>) => {
    setOverride(day, {
      status: "work",
      hours: day.hours > 0 ? day.hours : defaultWorkHours(),
      overtimeHours: day.overtimeHours,
      nightHours: day.nightHours,
      ...patch,
    });
  };

  const weekNote = (week: (typeof monthWeeks)[number]) => {
    if (week.holidayEligible) return `주휴 ${hoursText(week.holidayHours)}h`;
    if (week.absentDays > 0) return `결근 ${week.absentDays}일`;
    if (week.scheduledMinutes < 15 * 60) return "15시간 미만";
    return week.reasons[0] ?? "—";
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-ink">2. 달력으로 근무일 입력</h2>
        <span className="text-[10px] font-semibold text-ink-faint">요일 규칙 → 날짜 탭 수정</span>
      </div>

      {/* 월 이동 */}
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900 px-1.5 py-2 text-white">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => moveMonth(-1)}
          className="grid h-9 w-9 place-items-center rounded-xl text-lg font-bold text-slate-200 transition active:scale-95 active:bg-white/10"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="tnum text-[15px] font-extrabold leading-tight" aria-live="polite">
            {state.year}년 {state.month}월
          </p>
          <p className="mt-0.5 text-[10px] text-slate-300">
            근무 {result.workDays}일 · {hoursText(result.baseHours)}시간
          </p>
        </div>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => moveMonth(1)}
          className="grid h-9 w-9 place-items-center rounded-xl text-lg font-bold text-slate-200 transition active:scale-95 active:bg-white/10"
        >
          ›
        </button>
      </div>

      {/* 요일별 스케줄 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-bold text-ink-2">요일별 스케줄</span>
        <button
          type="button"
          onClick={() => onChange({ ...state, rules: state.rules.map((rule, index) => ({
            work: index >= 1 && index <= 5,
            hours: index >= 1 && index <= 5 ? DEFAULT_CALENDAR_HOURS : rule.hours,
          })) })}
          className="text-[11px] font-semibold text-brand underline decoration-brand/30 underline-offset-2"
        >
          월~금 기본값
        </button>
      </div>

      <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
        {WEEKDAY_ORDER.map((weekday) => {
          const rule = state.rules[weekday];
          return (
            <div key={weekday} className="flex items-center gap-2 px-2.5 py-1.5">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${
                  rule.work
                    ? weekday === 0
                      ? "bg-rose-500 text-white"
                      : weekday === 6
                        ? "bg-brand-500 text-white"
                        : "bg-brand text-white"
                    : "bg-slate-200 text-ink-faint"
                }`}
              >
                {WEEKDAY_LABEL[weekday]}
              </span>
              <MiniSwitch
                checked={rule.work}
                onChange={(next) => updateRule(weekday, { work: next })}
                label={`${WEEKDAY_LONG[weekday]} 근무`}
              />
              <span className={`text-[11px] ${rule.work ? "text-ink-2" : "text-ink-faint"}`}>
                {rule.work ? "근무" : "휴무"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.5}
                  aria-label={`${WEEKDAY_LONG[weekday]} 하루 근무시간`}
                  disabled={!rule.work}
                  value={rule.hours === 0 ? "" : String(rule.hours)}
                  placeholder="0"
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateRule(weekday, {
                      hours: Number.isFinite(parsed) ? Math.min(24, Math.max(0, parsed)) : 0,
                    });
                  }}
                  className="tnum w-[58px] rounded-lg border border-slate-300 bg-white py-1 pl-2 pr-1 text-right text-[12px] font-bold text-ink disabled:border-slate-200 disabled:bg-slate-100 disabled:text-ink-faint focus:border-brand focus:outline-none"
                />
                <span className="text-[10px] text-ink-muted">시간</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 휴게시간 */}
      <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 px-2.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-ink-2">하루 휴게시간(무급)</span>
          <div className="flex gap-1">
            {BREAK_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => onChange({ ...state, breakMinutes: minutes })}
                aria-pressed={state.breakMinutes === minutes}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  state.breakMinutes === minutes
                    ? "bg-brand text-white"
                    : "bg-white text-ink-muted ring-1 ring-slate-200"
                }`}
              >
                {minutes === 0 ? "없음" : `${minutes}분`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-muted">입력한 시간에 휴게 포함</span>
          <MiniSwitch
            checked={state.hoursIncludeBreak}
            onChange={(next) => onChange({ ...state, hoursIncludeBreak: next })}
            label="입력한 근무시간에 휴게시간 포함"
          />
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
          {state.hoursIncludeBreak
            ? `6시간 입력 → 휴게 ${state.breakMinutes}분 빼고 ${hoursText(Math.max(0, 6 - state.breakMinutes / 60))}시간으로 계산해요.`
            : "입력한 시간을 그대로 실근로시간으로 계산해요."}
        </p>
      </div>

      {/* 달력 */}
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold">
          {WEEKDAY_ORDER.map((weekday) => (
            <span
              key={weekday}
              className={
                weekday === 0 ? "text-rose-500" : weekday === 6 ? "text-brand" : "text-ink-muted"
              }
            >
              {WEEKDAY_LABEL[weekday]}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {allDays.map((day) => {
            if (!day.inMonth) {
              return (
                <span
                  key={day.key}
                  aria-hidden="true"
                  className="grid min-h-[46px] place-items-center rounded-xl text-[10px] text-slate-300"
                >
                  {day.day}
                </span>
              );
            }
            const isSelected = selected === day.key;
            const tone =
              day.state === "absent"
                ? "border-rose-200 bg-rose-50"
                : day.state === "work"
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50";
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelected(isSelected ? null : day.key)}
                aria-pressed={isSelected}
                aria-label={`${day.month}월 ${day.day}일 ${WEEKDAY_LONG[day.weekday]} ${
                  day.state === "absent"
                    ? "결근"
                    : day.state === "work"
                      ? `근무 ${hoursText(day.hours)}시간`
                      : "휴무"
                }`}
                className={`relative flex min-h-[46px] flex-col items-center justify-center rounded-xl border transition active:scale-[0.97] ${tone} ${
                  isSelected ? "ring-2 ring-brand ring-offset-1" : ""
                } ${day.overridden && !isSelected ? "border-dashed" : ""}`}
              >
                <span
                  className={`tnum text-[11px] font-bold leading-none ${
                    day.state === "absent"
                      ? "text-rose-500"
                      : day.state === "work"
                        ? "text-ink"
                        : "text-ink-faint"
                  }`}
                >
                  {day.day}
                </span>
                {day.state === "work" ? (
                  <span className="tnum mt-0.5 text-[9px] font-bold text-brand">
                    {hoursText(day.hours)}h
                  </span>
                ) : day.state === "absent" ? (
                  <span className="mt-0.5 text-[9px] font-bold text-rose-500">결근</span>
                ) : (
                  <span className="mt-0.5 text-[9px] text-ink-faint">—</span>
                )}
                {day.overtimeHours > 0 || day.nightHours > 0 ? (
                  <span className="absolute right-1 top-1 flex gap-0.5">
                    {day.overtimeHours > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    ) : null}
                    {day.nightHours > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-ink-faint">
          <span>날짜를 누르면 그날만 수정할 수 있어요</span>
          {overrideCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(withOverrides(state, {}))}
              className="font-semibold text-rose-500 underline decoration-rose-200 underline-offset-2"
            >
              이 달 수정 {overrideCount}건 지우기
            </button>
          ) : null}
        </div>
      </div>

      {/* 선택한 날짜 편집 */}
      {selectedDay ? (
        <div className="mt-3 animate-rise rounded-2xl border-2 border-brand/25 bg-brand-50/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-extrabold text-ink">
              {selectedDay.month}월 {selectedDay.day}일{" "}
              <span className="text-[11px] font-bold text-ink-muted">
                ({WEEKDAY_LABEL[selectedDay.weekday]})
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="날짜 편집 닫기"
              className="grid h-6 w-6 place-items-center rounded-lg text-[12px] text-ink-muted"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => openWork(selectedDay)}
              aria-pressed={selectedDay.state === "work"}
              className={`rounded-xl border py-2 text-[12px] font-bold transition ${
                selectedDay.state === "work"
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-ink-2"
              }`}
            >
              근무
            </button>
            <button
              type="button"
              onClick={() => setOverride(selectedDay, { status: "off" })}
              aria-pressed={selectedDay.state !== "work"}
              className={`rounded-xl border py-2 text-[12px] font-bold transition ${
                selectedDay.state !== "work"
                  ? "border-rose-300 bg-rose-500 text-white"
                  : "border-slate-200 bg-white text-ink-2"
              }`}
            >
              {selectedDay.scheduled ? "결근 · 휴무" : "휴무"}
            </button>
          </div>

          {selectedDay.state === "work" ? (
            <div className="mt-2.5 space-y-2">
              <div>
                <span className="mb-1 block text-[10px] font-semibold text-ink-muted">
                  하루 근무시간 (휴게 제외, 시간)
                </span>
                <NumericInput
                  value={selectedDay.hours}
                  onChange={(next) => patchWork(selectedDay, { hours: next })}
                  suffix="h"
                  ariaLabel="그날 근무시간"
                  placeholder="0"
                  max={24}
                  step={0.5}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-[10px] font-semibold text-ink-muted">
                    연장 ({selectedDay.overtimeHours > 0 ? "" : "선택"}1.5배)
                  </span>
                  <NumericInput
                    value={selectedDay.overtimeHours}
                    onChange={(next) => patchWork(selectedDay, { overtimeHours: next })}
                    suffix="h"
                    ariaLabel="그날 연장근로시간"
                    placeholder="0"
                    max={12}
                    step={0.5}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-semibold text-ink-muted">
                    야간 (22~06시 가산)
                  </span>
                  <NumericInput
                    value={selectedDay.nightHours}
                    onChange={(next) =>
                      patchWork(selectedDay, { nightHours: Math.min(next, selectedDay.hours) })
                    }
                    suffix="h"
                    ariaLabel="그날 야간근로시간"
                    placeholder="0"
                    max={12}
                    step={0.5}
                  />
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-faint">
                야간 시간은 기본 근무시간에 포함된 것으로 보고 가산분만 더해요. 연장은 기본 근무에
                더해 1.5배로 계산해요.
              </p>
            </div>
          ) : selectedDay.state === "absent" ? (
            <p className="mt-2.5 rounded-xl bg-rose-100/70 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-rose-700">
              결근으로 표시했어요. 이 주(월~일)는 개근이 아니어서 주휴수당이 빠집니다.
            </p>
          ) : (
            <p className="mt-2.5 rounded-xl bg-white/70 px-2.5 py-2 text-[11px] leading-relaxed text-ink-muted">
              휴무일이에요. 대타로 나가면 &lsquo;근무&rsquo;를 눌러 시간을 넣어 주세요.
            </p>
          )}

          <button
            type="button"
            onClick={() => setOverride(selectedDay, null)}
            disabled={!selectedDay.overridden}
            className="mt-2.5 w-full rounded-xl border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-ink-muted transition disabled:opacity-40"
          >
            요일 규칙으로 되돌리기
          </button>
        </div>
      ) : null}

      {/* 주휴수당 판정 */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink-2">주휴수당 판정</span>
          <span className="text-[10px] text-ink-faint">주휴일 = 일요일</span>
        </div>
        <div className="mt-1.5 space-y-1">
          {monthWeeks.map((week) => (
            <div
              key={week.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <span className="tnum shrink-0 text-[10px] font-semibold text-ink-muted">{week.label}</span>
              <span className="tnum min-w-0 truncate text-[10px] text-ink-2">
                {week.workedDays}일 · {hoursText(week.workedMinutes / 60)}h
              </span>
              <span
                className={`shrink-0 text-[10px] font-bold ${
                  week.holidayEligible
                    ? "text-emerald-600"
                    : week.absentDays > 0
                      ? "text-rose-500"
                      : "text-ink-faint"
                }`}
              >
                {weekNote(week)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 rounded-xl bg-slate-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-faint">
          주휴수당은 주(월~일) 소정근로 15시간 이상 + 예정 근무일 개근일 때 지급돼요. 이번 달 밖
          날짜는 요일 규칙대로 근무한 것으로 보고, 주휴일(일요일)이 이번 달에 있는 주만 계산해요.
        </p>
      </div>

      {/* 달력 합계 */}
      <div className="mt-3 space-y-1.5 rounded-2xl bg-slate-900 px-3.5 py-3 text-white">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300">
            {state.month}월 근무 {result.workDays}일 · {hoursText(result.baseHours)}시간
          </span>
          <span className="tnum font-bold">{won(result.basePay)}원</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300">
            주휴 {result.holidayWeeks}주 · {hoursText(result.holidayHours)}시간
          </span>
          <span className="tnum font-bold text-brand-100">+{won(result.holidayPay)}원</span>
        </div>
        {result.overtimePay > 0 || result.nightPay > 0 ? (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300">
              연장 {hoursText(result.overtimeHours)}h · 야간 {hoursText(result.nightHours)}h
            </span>
            <span className="tnum font-bold text-amber-200">
              +{won(result.overtimePay + result.nightPay)}원
            </span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between border-t border-white/15 pt-1.5">
          <span className="text-[11px] font-semibold text-slate-200">세전 합계 (시급 {won(wage)}원)</span>
          <span className="tnum text-[14px] font-extrabold">{won(result.gross)}원</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
        달력 수정과 요일 규칙은 이 브라우저에만 저장돼요(월별로 따로 저장).
      </p>
    </section>
  );
}
