/**
 * 알바영수증 — 실제 달력 기반 급여 계산 (순수 함수)
 *
 * 간편 평균(4.345주) 대신, 선택한 달의 실제 1일~말일 달력을 만들어
 * 요일별 스케줄 + 날짜별 수정(대타·연장·야간·결근)을 그대로 합산한다.
 *
 * 규칙
 *  - 기본급: 그 달에 실제로 근무한 날의 실근로시간(휴게 제외) 합계 × 시급
 *  - 주휴수당: 주 단위(월~일)로 판정한다.
 *      · 주 소정근로시간 15시간 이상
 *      · 그 주의 예정 근무일을 모두 출근(결근 없음)
 *      · 주휴일(일요일)이 해당 달에 있는 주만 그 달에 계상
 *    지급액 = min(주 소정근로시간 ÷ 40 × 8시간, 8시간) × 시급
 *  - 연장: 기본 근무에 더해 1.5배(5인 이상) / 1배(5인 미만)
 *  - 야간(22:00~06:00): 기본 근무시간에 포함된 것으로 보고 0.5배 가산분만 더한다
 */
import {
  calcDeductions,
  HOLIDAY_PAY_MIN_WEEKLY_HOURS,
  type DeductionLine,
  type TaxType,
} from "./pay.ts";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 달력 표시 순서: 월요일 시작 */
export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

export const WEEKDAY_LONG: Record<Weekday, string> = {
  0: "일요일",
  1: "월요일",
  2: "화요일",
  3: "수요일",
  4: "목요일",
  5: "금요일",
  6: "토요일",
};

export interface WeekdayRule {
  /** 그 요일에 근무하는지 */
  work: boolean;
  /** 하루 근무시간(시간). hoursIncludeBreak에 따라 휴게 포함/제외 */
  hours: number;
}

export interface DayOverride {
  /** work = 그날 근무, off = 그날 쉼(예정 근무일이면 결근) */
  status: "work" | "off";
  /** 실근로시간(휴게 제외, 시간) */
  hours?: number;
  /** 연장근로시간(시간) — 기본 근무에 더해 1.5배 */
  overtimeHours?: number;
  /** 야간근로시간(22:00~06:00, 시간) — 기본 근무에 포함, 가산만 */
  nightHours?: number;
}

export interface CalendarInput {
  year: number;
  month: number; // 1~12
  /** 요일별로 입력한 시간에 휴게시간이 포함되어 있는지 */
  hoursIncludeBreak: boolean;
  /** 하루 휴게시간(무급, 분) */
  breakMinutes: number;
  /** index: 0=일 … 6=토 */
  rules: WeekdayRule[];
  /** "YYYY-MM-DD" → 그날 수정 */
  overrides: Record<string, DayOverride>;
}

/** localStorage에 저장하는 달력 상태 — 월별 수정 내역을 함께 보관한다 */
export interface CalendarState {
  year: number;
  month: number;
  hoursIncludeBreak: boolean;
  breakMinutes: number;
  rules: WeekdayRule[];
  /** "YYYY-MM" → 그 달의 날짜별 수정 */
  months: Record<string, Record<string, DayOverride>>;
}

export const DEFAULT_CALENDAR_HOURS = 6;
export const DEFAULT_CALENDAR_BREAK = 30;

export function defaultWeekdayRules(): WeekdayRule[] {
  return [
    { work: false, hours: 0 }, // 일
    { work: true, hours: DEFAULT_CALENDAR_HOURS }, // 월
    { work: true, hours: DEFAULT_CALENDAR_HOURS }, // 화
    { work: true, hours: DEFAULT_CALENDAR_HOURS }, // 수
    { work: true, hours: DEFAULT_CALENDAR_HOURS }, // 목
    { work: true, hours: DEFAULT_CALENDAR_HOURS }, // 금
    { work: false, hours: 0 }, // 토
  ];
}

export function defaultCalendarState(now: Date = new Date()): CalendarState {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    hoursIncludeBreak: true,
    breakMinutes: DEFAULT_CALENDAR_BREAK,
    rules: defaultWeekdayRules(),
    months: {},
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");

export const monthKey = (year: number, month: number) => `${year}-${pad2(month)}`;

export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function weekdayOfDate(year: number, month: number, day: number): Weekday {
  return new Date(year, month - 1, day).getDay() as Weekday;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

const clampHours = (value: number, max = 24): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
};

const toMinutes = (hours: number): number => Math.round(clampHours(hours) * 60);

const round2 = (value: number): number => Math.round(value * 100) / 100;

const breakOf = (input: CalendarInput): number =>
  Math.min(600, Math.max(0, Number.isFinite(input.breakMinutes) ? input.breakMinutes : 0));

/** 요일 규칙만 적용한 하루 실근로시간(분) — 휴게 제외 */
function ruleMinutes(input: CalendarInput, weekday: Weekday): number {
  const rule = input.rules[weekday];
  if (!rule || !rule.work) return 0;
  const raw = toMinutes(rule.hours);
  if (input.hoursIncludeBreak) return Math.max(0, raw - Math.round(breakOf(input)));
  return raw;
}

export type DayState = "work" | "off" | "absent";

export interface CalendarDay {
  key: string;
  year: number;
  month: number;
  day: number;
  weekday: Weekday;
  inMonth: boolean;
  /** 요일 규칙상 근무 예정이었는지 */
  scheduled: boolean;
  state: DayState;
  overridden: boolean;
  /** 실근로시간(휴게 제외) */
  hours: number;
  /** 소정근로시간(휴게 제외) — 주휴 판정용 */
  scheduledHours: number;
  overtimeHours: number;
  nightHours: number;
}

function resolveDay(input: CalendarInput, year: number, month: number, day: number): CalendarDay {
  const weekday = weekdayOfDate(year, month, day);
  const key = dateKey(year, month, day);
  const baseMinutes = ruleMinutes(input, weekday);
  const scheduled = baseMinutes > 0;
  const override = input.overrides[key];

  let state: DayState = scheduled ? "work" : "off";
  let minutes = baseMinutes;
  let scheduledMinutes = baseMinutes;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let overridden = false;

  if (override) {
    overridden = true;
    if (override.status === "off") {
      state = scheduled ? "absent" : "off";
      minutes = 0;
      scheduledMinutes = 0;
      overtimeMinutes = 0;
      nightMinutes = 0;
    } else {
      state = "work";
      minutes =
        typeof override.hours === "number" ? toMinutes(override.hours) : baseMinutes;
      scheduledMinutes = minutes;
      overtimeMinutes = toMinutes(override.overtimeHours ?? 0);
      nightMinutes = Math.min(toMinutes(override.nightHours ?? 0), minutes);
    }
  }

  return {
    key,
    year,
    month,
    day,
    weekday,
    inMonth: year === input.year && month === input.month,
    scheduled,
    state,
    overridden,
    hours: round2(minutes / 60),
    scheduledHours: round2(scheduledMinutes / 60),
    overtimeHours: round2(overtimeMinutes / 60),
    nightHours: round2(nightMinutes / 60),
  };
}

export interface CalendarWeek {
  /** 월요일 날짜 키 */
  key: string;
  label: string;
  days: CalendarDay[];
  /** 이번 달에 속한 날짜 */
  inMonthDays: CalendarDay[];
  /** 주휴일(일요일)이 이번 달에 있는지 */
  holidayInMonth: boolean;
  scheduledDays: number;
  workedDays: number;
  absentDays: number;
  scheduledMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayEligible: boolean;
  holidayHours: number;
  /** 지급되지 않는 이유(지급되면 빈 배열) */
  reasons: string[];
}

const MIN_WEEKLY_MINUTES = HOLIDAY_PAY_MIN_WEEKLY_HOURS * 60;

export function buildCalendarWeeks(input: CalendarInput): CalendarWeek[] {
  const first = new Date(input.year, input.month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7; // 월요일 = 0
  const totalCells = startOffset + daysInMonth(input.year, input.month);
  const weekCount = Math.ceil(totalCells / 7);
  const weeks: CalendarWeek[] = [];

  for (let w = 0; w < weekCount; w += 1) {
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const cursor = new Date(
        input.year,
        input.month - 1,
        1 - startOffset + w * 7 + i,
      );
      days.push(
        resolveDay(input, cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()),
      );
    }

    const inMonthDays = days.filter((day) => day.inMonth);
    const holidayInMonth = days[6].inMonth;
    const absentDays = days.filter((day) => day.state === "absent").length;
    const scheduledMinutes = days.reduce(
      (sum, day) => sum + Math.round(day.scheduledHours * 60),
      0,
    );
    const workedMinutes = days.reduce((sum, day) => sum + Math.round(day.hours * 60), 0);
    const overtimeMinutes = days.reduce(
      (sum, day) => sum + Math.round(day.overtimeHours * 60),
      0,
    );
    const nightMinutes = days.reduce((sum, day) => sum + Math.round(day.nightHours * 60), 0);
    const hasTwoWorkHours = scheduledMinutes > 0;

    const reasons: string[] = [];
    if (!holidayInMonth) reasons.push("주휴일이 다음 달이라 다음 달에 정산");
    if (absentDays > 0) reasons.push(`결근 ${absentDays}일`);
    if (scheduledMinutes < MIN_WEEKLY_MINUTES) reasons.push("주 15시간 미만");
    if (!hasTwoWorkHours) reasons.push("근무 예정일 없음");

    const holidayEligible =
      holidayInMonth && absentDays === 0 && scheduledMinutes >= MIN_WEEKLY_MINUTES;
    const holidayHours = holidayEligible
      ? round2(Math.min((scheduledMinutes / 60 / 40) * 8, 8))
      : 0;

    weeks.push({
      key: days[0].key,
      label: `${days[0].month}/${days[0].day}~${days[6].month}/${days[6].day}`,
      days,
      inMonthDays,
      holidayInMonth,
      scheduledDays: days.filter((day) => day.scheduled).length,
      workedDays: days.filter((day) => day.state === "work" && Math.round(day.hours * 60) > 0)
        .length,
      absentDays,
      scheduledMinutes,
      workedMinutes,
      overtimeMinutes,
      nightMinutes,
      holidayEligible,
      holidayHours,
      reasons,
    });
  }

  return weeks;
}

export interface CalendarPayOptions {
  hourlyWage: number;
  probation: boolean;
  fiveOrMoreEmployees: boolean;
  taxType: TaxType;
}

export interface CalendarWeekSummary extends CalendarWeek {
  /** 그 주에 지급되는 주휴수당 */
  holidayPay: number;
}

export interface CalendarPayResult {
  mode: "calendar";
  year: number;
  month: number;
  effectiveWage: number;
  probationApplied: boolean;
  /** 이번 달 실제 근무일수 */
  workDays: number;
  /** 이번 달 기본급 시간 */
  baseHours: number;
  basePay: number;
  holidayEligible: boolean;
  /** 주휴수당이 지급되는 주 수 */
  holidayWeeks: number;
  holidayHours: number;
  holidayPay: number;
  holidayNote: string;
  overtimeHours: number;
  overtimePay: number;
  overtimeMultiplier: number;
  nightHours: number;
  nightPay: number;
  nightPremiumMultiplier: number;
  /** 기본급 + 주휴 + 연장/야간 시간 합계 */
  totalHours: number;
  weeks: CalendarWeekSummary[];
  gross: number;
  deductions: DeductionLine[];
  totalDeduction: number;
  net: number;
  hourlyNet: number;
  taxType: TaxType;
}

export function calcCalendarPay(
  input: CalendarInput,
  options: CalendarPayOptions,
): CalendarPayResult {
  const wage = Math.max(0, Math.floor(options.hourlyWage) || 0);
  const probationApplied = options.probation;
  const effectiveWage = probationApplied ? Math.floor(wage * 0.9) : wage;

  const weeks = buildCalendarWeeks(input);
  const monthWeeks = weeks.filter((week) => week.inMonthDays.length > 0);
  const inMonthDays = weeks.flatMap((week) => week.inMonthDays);

  const baseMinutes = inMonthDays.reduce((sum, day) => sum + Math.round(day.hours * 60), 0);
  const overtimeMinutes = inMonthDays.reduce(
    (sum, day) => sum + Math.round(day.overtimeHours * 60),
    0,
  );
  const nightMinutes = inMonthDays.reduce(
    (sum, day) => sum + Math.round(day.nightHours * 60),
    0,
  );

  const fivePlus = options.fiveOrMoreEmployees;
  const overtimeMultiplier = fivePlus ? 1.5 : 1;
  const nightPremiumMultiplier = fivePlus ? 0.5 : 0;

  const baseHours = round2(baseMinutes / 60);
  const basePay = Math.round((baseMinutes / 60) * effectiveWage);

  const weekSummaries: CalendarWeekSummary[] = weeks.map((week) => ({
    ...week,
    holidayPay: Math.round(week.holidayHours * effectiveWage),
  }));
  const paidWeeks = weekSummaries.filter((week) => week.holidayHours > 0);
  const holidayHours = round2(paidWeeks.reduce((sum, week) => sum + week.holidayHours, 0));
  const holidayPay = paidWeeks.reduce((sum, week) => sum + week.holidayPay, 0);

  const overtimeHours = round2(overtimeMinutes / 60);
  const nightHours = round2(nightMinutes / 60);
  const overtimePay = Math.round(overtimeHours * effectiveWage * overtimeMultiplier);
  const nightPay = Math.round(nightHours * effectiveWage * nightPremiumMultiplier);

  const gross = basePay + holidayPay + overtimePay + nightPay;
  const { deductions, totalDeduction } = calcDeductions(gross, options.taxType);
  const net = gross - totalDeduction;
  const totalHours = round2(baseHours + holidayHours + overtimeHours + nightHours);
  const hourlyNet = totalHours > 0 ? Math.round(net / totalHours) : 0;

  const absentWeeks = monthWeeks.filter((week) => week.absentDays > 0).length;
  const shortWeeks = monthWeeks.filter(
    (week) => week.absentDays === 0 && week.scheduledMinutes < MIN_WEEKLY_MINUTES,
  ).length;
  const nextMonthWeeks = monthWeeks.filter((week) => !week.holidayInMonth).length;
  const noteParts: string[] = [];
  if (paidWeeks.length > 0) noteParts.push(`${paidWeeks.length}주 지급`);
  if (absentWeeks > 0) noteParts.push(`결근 ${absentWeeks}주 제외`);
  if (shortWeeks > 0) noteParts.push(`15시간 미만 ${shortWeeks}주`);
  if (nextMonthWeeks > 0) noteParts.push(`마지막 주는 다음 달 정산`);

  return {
    mode: "calendar",
    year: input.year,
    month: input.month,
    effectiveWage,
    probationApplied,
    workDays: inMonthDays.filter((day) => Math.round(day.hours * 60) > 0).length,
    baseHours,
    basePay,
    holidayEligible: holidayHours > 0,
    holidayWeeks: paidWeeks.length,
    holidayHours,
    holidayPay,
    holidayNote: noteParts.join(" · ") || "주휴수당 없음",
    overtimeHours,
    overtimePay,
    overtimeMultiplier,
    nightHours,
    nightPay,
    nightPremiumMultiplier,
    totalHours,
    weeks: weekSummaries,
    gross,
    deductions,
    totalDeduction,
    net,
    hourlyNet,
    taxType: options.taxType,
  };
}

export function calendarInputOf(state: CalendarState): CalendarInput {
  return {
    year: state.year,
    month: state.month,
    hoursIncludeBreak: state.hoursIncludeBreak,
    breakMinutes: state.breakMinutes,
    rules: state.rules,
    overrides: state.months[monthKey(state.year, state.month)] ?? {},
  };
}

export function withOverrides(
  state: CalendarState,
  overrides: Record<string, DayOverride>,
): CalendarState {
  const key = monthKey(state.year, state.month);
  return { ...state, months: { ...state.months, [key]: overrides } };
}

function sanitizeRules(raw: unknown): WeekdayRule[] {
  const fallback = defaultWeekdayRules();
  if (!Array.isArray(raw)) return fallback;
  return fallback.map((rule, index) => {
    const item = raw[index] as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") return rule;
    return {
      work: typeof item.work === "boolean" ? item.work : rule.work,
      hours: clampHours(typeof item.hours === "number" ? item.hours : rule.hours),
    };
  });
}

function sanitizeOverride(raw: unknown): DayOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (src.status !== "work" && src.status !== "off") return null;
  if (src.status === "off") return { status: "off" };
  return {
    status: "work",
    hours: clampHours(typeof src.hours === "number" ? src.hours : 0),
    overtimeHours: clampHours(typeof src.overtimeHours === "number" ? src.overtimeHours : 0),
    nightHours: clampHours(typeof src.nightHours === "number" ? src.nightHours : 0),
  };
}

function sanitizeOverrideMap(raw: unknown): Record<string, DayOverride> {
  const result: Record<string, DayOverride> = {};
  if (!raw || typeof raw !== "object") return result;
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const override = sanitizeOverride(value);
    if (override) result[key] = override;
  });
  return result;
}

export function sanitizeCalendarState(raw: unknown): CalendarState {
  const fallback = defaultCalendarState();
  if (!raw || typeof raw !== "object") return fallback;
  const src = raw as Record<string, unknown>;
  const year =
    typeof src.year === "number" && Number.isFinite(src.year)
      ? Math.min(2100, Math.max(2000, Math.round(src.year)))
      : fallback.year;
  const month =
    typeof src.month === "number" && src.month >= 1 && src.month <= 12
      ? Math.round(src.month)
      : fallback.month;
  const months: Record<string, Record<string, DayOverride>> = {};
  if (src.months && typeof src.months === "object") {
    Object.entries(src.months as Record<string, unknown>).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}$/.test(key)) return;
      months[key] = sanitizeOverrideMap(value);
    });
  }

  return {
    year,
    month,
    hoursIncludeBreak:
      typeof src.hoursIncludeBreak === "boolean" ? src.hoursIncludeBreak : fallback.hoursIncludeBreak,
    breakMinutes:
      typeof src.breakMinutes === "number" && Number.isFinite(src.breakMinutes)
        ? Math.min(600, Math.max(0, Math.round(src.breakMinutes)))
        : fallback.breakMinutes,
    rules: sanitizeRules(src.rules),
    months,
  };
}

/** 화면 표시용 시간 문자열: 6 → "6", 5.5 → "5.5" */
export function hoursText(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
