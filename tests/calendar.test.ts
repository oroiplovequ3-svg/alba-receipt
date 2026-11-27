import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCalendarWeeks,
  calcCalendarPay,
  calendarInputOf,
  defaultCalendarState,
  sanitizeCalendarState,
  shiftMonth,
  type CalendarInput,
  type DayOverride,
} from "../src/lib/calendar.ts";
import { MIN_WAGE_2026 } from "../src/lib/pay.ts";

const rules = (hours: Record<number, number>): CalendarInput["rules"] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const value = hours[weekday];
    return typeof value === "number" && value > 0
      ? { work: true, hours: value }
      : { work: false, hours: 0 };
  });

/** 2026년 11월 · 월~금 하루 8시간(휴게 없음) */
const nov = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  year: 2026,
  month: 11,
  hoursIncludeBreak: false,
  breakMinutes: 0,
  rules: rules({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 }),
  overrides: {},
  ...over,
});

const pay = (input: CalendarInput, fiveOrMore = true) =>
  calcCalendarPay(input, {
    hourlyWage: MIN_WAGE_2026,
    probation: false,
    fiveOrMoreEmployees: fiveOrMore,
    taxType: "none",
  });

test("2026년 11월 달력: 평일만 근무하면 실제 근무일수·시간을 그대로 합산한다", () => {
  const input = nov();
  const weeks = buildCalendarWeeks(input);
  assert.equal(weeks.length, 6); // 10/26~11/1 … 11/30~12/6
  assert.equal(weeks[0].inMonthDays.length, 1); // 11/1(일)만
  assert.equal(weeks[0].holidayInMonth, true);
  assert.equal(weeks[5].holidayInMonth, false); // 주휴일(12/6)은 다음 달

  const result = pay(input);
  // 2026년 11월 평일: 2~6, 9~13, 16~20, 23~27, 30 → 21일
  assert.equal(result.workDays, 21);
  assert.equal(result.baseHours, 168);
  assert.equal(result.basePay, 168 * MIN_WAGE_2026);

  // 주휴일(일요일)이 11월에 있는 5주 — 각 주 소정근로 40시간
  assert.equal(result.holidayWeeks, 5);
  assert.equal(result.holidayHours, 40);
  assert.equal(result.holidayPay, 40 * MIN_WAGE_2026);
  assert.equal(result.gross, result.basePay + result.holidayPay);
  assert.ok(result.holidayNote.includes("5주 지급"));
});

test("특정 주에 결근 표시가 있으면 그 주 주휴수당만 빠진다", () => {
  const input = nov({ overrides: { "2026-11-10": { status: "off" } } });
  const result = pay(input);

  assert.equal(result.workDays, 20);
  assert.equal(result.baseHours, 160);
  assert.equal(result.holidayWeeks, 4);
  assert.equal(result.holidayHours, 32);
  assert.equal(result.holidayPay, 32 * MIN_WAGE_2026);

  const week = result.weeks.find((item) => item.inMonthDays.some((day) => day.day === 10));
  assert.ok(week);
  assert.equal(week.holidayEligible, false);
  assert.equal(week.absentDays, 1);
  assert.ok(result.holidayNote.includes("결근 1주 제외"));
});

test("대타(휴무일 근무)와 그날만 시간 변경이 기본급에 반영된다", () => {
  const transfer: Record<string, DayOverride> = {
    "2026-11-07": { status: "work", hours: 4 }, // 토요일 대타 4시간
    "2026-11-05": { status: "work", hours: 4 }, // 목요일 8시간 → 4시간
  };
  const result = pay(nov({ overrides: transfer }));

  // 21일 × 8시간 = 168 → 목요일 -4시간, 토요일 +4시간
  assert.equal(result.baseHours, 168);
  assert.equal(result.basePay, 168 * MIN_WAGE_2026);

  // 토요일 대타가 들어간 주(11/2~11/8)는 목요일 -4시간 + 토요일 +4시간 = 40시간
  const week = result.weeks.find((item) => item.inMonthDays.some((day) => day.day === 5));
  assert.ok(week);
  assert.equal(week.scheduledMinutes, 40 * 60);
  assert.equal(week.holidayHours, 8);
});

test("주 15시간 미만인 주는 주휴수당이 발생하지 않는다", () => {
  const result = pay(nov({ rules: rules({ 1: 4, 3: 4, 5: 4 }) })); // 월·수·금 12시간
  assert.equal(result.workDays, 13);
  assert.equal(result.baseHours, 52);
  assert.equal(result.holidayWeeks, 0);
  assert.equal(result.holidayPay, 0);
  assert.ok(result.holidayNote.includes("15시간 미만"));
});

test("휴게시간은 요일별 입력 시간에서 빠지고, 휴게 제외 입력도 지원한다", () => {
  const withBreak = pay(
    nov({
      hoursIncludeBreak: true,
      breakMinutes: 60,
      rules: rules({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 }),
    }),
  );
  assert.equal(withBreak.baseHours, 21 * 7);
  assert.equal(withBreak.holidayHours, 35); // 35시간 주 → 7시간 × 5주

  const withoutBreak = pay(
    nov({
      hoursIncludeBreak: false,
      breakMinutes: 60,
      rules: rules({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 }),
    }),
  );
  assert.equal(withoutBreak.baseHours, 168);
});

test("날짜별 연장·야간에 5인 이상 가산이 붙고, 5인 미만은 야간 가산이 없다", () => {
  const overrides: Record<string, DayOverride> = {
    "2026-11-16": { status: "work", hours: 8, overtimeHours: 2, nightHours: 3 },
  };
  const fivePlus = pay(nov({ overrides }));
  const day = fivePlus.weeks
    .flatMap((week) => week.inMonthDays)
    .find((item) => item.key === "2026-11-16");
  assert.ok(day);
  assert.equal(day.overtimeHours, 2);
  assert.equal(day.nightHours, 3);

  assert.equal(fivePlus.overtimeHours, 2);
  assert.equal(fivePlus.overtimePay, Math.round(2 * MIN_WAGE_2026 * 1.5));
  assert.equal(fivePlus.nightHours, 3);
  assert.equal(fivePlus.nightPay, Math.round(3 * MIN_WAGE_2026 * 0.5));
  assert.equal(
    fivePlus.gross,
    fivePlus.basePay + fivePlus.holidayPay + fivePlus.overtimePay + fivePlus.nightPay,
  );

  const under5 = pay(nov({ overrides }), false);
  assert.equal(under5.overtimePay, Math.round(2 * MIN_WAGE_2026 * 1));
  assert.equal(under5.nightPay, 0);
});

test("3.3% / 4대보험 공제가 달력 계산 결과에도 적용된다", () => {
  const base = calcCalendarPay(nov(), {
    hourlyWage: MIN_WAGE_2026,
    probation: false,
    fiveOrMoreEmployees: true,
    taxType: "freelancer",
  });
  const expectedTax =
    Math.round(base.gross * 0.03) + Math.round(base.gross * 0.003);
  assert.equal(base.totalDeduction, expectedTax);
  assert.equal(base.net, base.gross - expectedTax);

  const insured = calcCalendarPay(nov(), {
    hourlyWage: MIN_WAGE_2026,
    probation: false,
    fiveOrMoreEmployees: true,
    taxType: "insurance",
  });
  const keys = Object.fromEntries(insured.deductions.map((line) => [line.key, line.amount]));
  assert.equal(keys.pension, Math.round(insured.gross * 0.0475));
  assert.equal(keys.health, Math.round(insured.gross * 0.03595));
  assert.equal(keys.longTermCare, Math.round(insured.gross * 0.03595 * 0.1314));
  assert.equal(keys.employment, Math.round(insured.gross * 0.009));
  assert.equal(insured.net, insured.gross - insured.totalDeduction);
});

test("수습 90% 시급이 달력 계산에도 반영된다", () => {
  const result = calcCalendarPay(nov(), {
    hourlyWage: 10_000,
    probation: true,
    fiveOrMoreEmployees: true,
    taxType: "none",
  });
  assert.equal(result.effectiveWage, 9000);
  assert.equal(result.basePay, 168 * 9000);
});

test("요일별 스케줄을 바꾸면 해당 월 날짜 전체에 즉시 반영된다", () => {
  const sixDays = pay(nov({ rules: rules({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 8 }) }));
  // 11월 토요일: 7, 14, 21, 28 → 4일 추가
  assert.equal(sixDays.workDays, 25);
  assert.equal(sixDays.baseHours, 200);
});

test("월 이동과 저장 상태 변환", () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2026, month: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });

  const state = defaultCalendarState(new Date(2026, 10, 15));
  assert.equal(state.year, 2026);
  assert.equal(state.month, 11);
  assert.equal(state.rules.filter((rule) => rule.work).length, 5);

  const saved = {
    ...state,
    months: { "2026-11": { "2026-11-03": { status: "off" } } },
  };
  const restored = sanitizeCalendarState(JSON.parse(JSON.stringify(saved)));
  const input = calendarInputOf(restored);
  assert.equal(input.overrides["2026-11-03"].status, "off");

  // 깨진 값은 안전한 기본값으로 보정한다
  const broken = sanitizeCalendarState({ year: 100, month: 99, rules: "x", months: [] });
  assert.equal(broken.month >= 1 && broken.month <= 12, true);
  assert.equal(broken.rules.length, 7);
});
