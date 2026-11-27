import test from "node:test";
import assert from "node:assert/strict";

import {
  calcPay,
  calcWeeklyHours,
  compareRealPay,
  INSURANCE_RATES,
  INSURANCE_TOTAL_RATE,
  MIN_WAGE_2026,
  MIN_WAGE_2026_MONTHLY,
  MIN_WAGE_2027,
  MIN_WAGE_2027_MONTHLY,
  WEEKS_PER_MONTH,
  type PayInput,
} from "../src/lib/pay.ts";

const base = (over: Partial<PayInput> = {}): PayInput => ({
  hourlyWage: MIN_WAGE_2026,
  weeklyDays: 5,
  dailyHours: 8,
  breakMinutes: 60,
  useDirectHours: false,
  directWeeklyHours: 0,
  taxType: "none",
  probation: false,
  fiveOrMoreEmployees: true,
  overtimeHours: 0,
  nightHours: 0,
  ...over,
});

test("2026 최저시급 10,320원 · 주 40시간 → 월 209시간 환산액 2,156,880원", () => {
  const r = calcPay(base());
  assert.equal(r.weeklyHours, 35); // 하루 8시간 - 휴게 1시간 = 7시간 × 5일
  // 주 40시간(휴게 0분) 기준
  const full = calcPay(base({ breakMinutes: 0 }));
  assert.equal(full.weeklyHours, 40);
  assert.equal(full.monthlyBaseHours, 174);
  assert.equal(full.monthlyHolidayHours, 35);
  assert.equal(full.monthlyHours, 209);
  assert.equal(full.gross, MIN_WAGE_2026_MONTHLY);
  assert.equal(full.net, MIN_WAGE_2026_MONTHLY); // 공제 미적용
});

test("2027 최저시급 10,700원 · 209시간 → 2,236,300원", () => {
  const r = calcPay(base({ hourlyWage: MIN_WAGE_2027, breakMinutes: 0 }));
  assert.equal(MIN_WAGE_2027, 10_700);
  assert.equal(r.monthlyHours, 209);
  assert.equal(r.gross, MIN_WAGE_2027_MONTHLY);
});

test("휴게시간은 주당 실근로시간에서 제외된다", () => {
  assert.equal(calcWeeklyHours(base({ breakMinutes: 60 })), 35);
  assert.equal(calcWeeklyHours(base({ breakMinutes: 30 })), 37.5);
  assert.equal(calcWeeklyHours(base({ breakMinutes: 0 })), 40);
  const r = calcPay(base({ breakMinutes: 60 }));
  assert.equal(r.monthlyBaseHours, 152); // 35 × 4.345 = 152.07 → 152
  assert.equal(r.monthlyHolidayHours, 30); // 7 × 4.345 = 30.4 → 30
});

test("주 소정근로 15시간 이상일 때만 주휴수당이 발생한다", () => {
  const exactly15 = calcPay(base({ weeklyDays: 3, dailyHours: 5, breakMinutes: 0 }));
  assert.equal(exactly15.weeklyHours, 15);
  assert.equal(exactly15.holidayEligible, true);
  assert.ok(exactly15.monthlyHoliday > 0);
  assert.equal(exactly15.weeklyHolidayHours, 3); // 15/40*8

  const under15 = calcPay(base({ weeklyDays: 3, dailyHours: 4, breakMinutes: 0 }));
  assert.equal(under15.weeklyHours, 12);
  assert.equal(under15.holidayEligible, false);
  assert.equal(under15.monthlyHoliday, 0);
  assert.equal(under15.monthlyHolidayHours, 0);
});

test("주휴수당은 주 40시간을 넘어도 최대 8시간분까지만 계산한다", () => {
  const r = calcPay(base({ weeklyDays: 6, dailyHours: 8, breakMinutes: 0 }));
  assert.equal(r.weeklyHours, 48);
  assert.equal(r.weeklyHolidayHours, 8);
});

test("4대보험 근로자 부담률 9.7%가 항목별로 반영된다", () => {
  const r = calcPay(base({ breakMinutes: 0, taxType: "insurance" }));
  assert.equal(r.gross, MIN_WAGE_2026_MONTHLY);

  const byKey = Object.fromEntries(r.deductions.map((d) => [d.key, d.amount]));
  assert.equal(byKey.pension, Math.round(r.gross * 0.0475));
  assert.equal(byKey.health, Math.round(r.gross * 0.03595));
  assert.equal(byKey.longTermCare, Math.round(r.gross * 0.03595 * 0.1314));
  assert.equal(byKey.employment, Math.round(r.gross * 0.009));

  const sum = r.deductions.reduce((s, d) => s + d.amount, 0);
  assert.equal(r.totalDeduction, sum);
  assert.equal(r.net, r.gross - sum);

  // 합산 부담률은 9.7%대 (9.717%)
  assert.ok(Math.abs(INSURANCE_TOTAL_RATE - 0.09717) < 0.0001);
  const effectiveRate = sum / r.gross;
  assert.ok(effectiveRate > 0.0969 && effectiveRate < 0.0973, `공제율 ${effectiveRate}`);
  assert.ok(
    Math.abs(INSURANCE_RATES.health * 0.1314 - INSURANCE_RATES.longTermCare) < 1e-12,
    "장기요양보험료는 건강보험료의 13.14%",
  );
});

test("3.3% 원천징수 = 소득세 3% + 지방소득세 0.3%", () => {
  const r = calcPay(base({ breakMinutes: 0, taxType: "freelancer" }));
  const expected = Math.round(r.gross * 0.03) + Math.round(r.gross * 0.003);
  assert.equal(r.totalDeduction, expected);
  assert.equal(r.net, r.gross - expected);
  assert.equal(r.deductions.length, 2);
});

test("미적용(0%)이면 공제가 없다", () => {
  const r = calcPay(base({ taxType: "none" }));
  assert.equal(r.totalDeduction, 0);
  assert.equal(r.deductions.length, 0);
  assert.equal(r.net, r.gross);
});

test("5인 이상 사업장은 연장 50%·야간 50% 가산, 5인 미만은 가산 없음", () => {
  const fivePlus = calcPay(base({ breakMinutes: 0, overtimeHours: 5, nightHours: 4 }));
  const fivePlusByKey = Object.fromEntries(fivePlus.deductions.map((d) => [d.key, d.amount]));

  assert.equal(fivePlus.overtimeMultiplier, 1.5);
  assert.equal(fivePlus.nightPremiumMultiplier, 0.5);
  assert.equal(fivePlus.monthlyOvertimeHours, 22); // 5 × 4.345 = 21.7 → 22
  assert.equal(fivePlus.monthlyNightHours, 17); // 4 × 4.345 = 17.4 → 17
  assert.ok(
    Math.abs(fivePlus.monthlyOvertime - fivePlus.monthlyOvertimeHours * MIN_WAGE_2026 * 1.5) < 1,
  );
  assert.ok(
    Math.abs(fivePlus.monthlyNight - fivePlus.monthlyNightHours * MIN_WAGE_2026 * 0.5) < 1,
  );
  assert.equal(fivePlus.gross, fivePlus.monthlyBase + fivePlus.monthlyHoliday + fivePlus.monthlyOvertime + fivePlus.monthlyNight);
  void fivePlusByKey;

  const under5 = calcPay(
    base({ breakMinutes: 0, fiveOrMoreEmployees: false, overtimeHours: 5, nightHours: 4 }),
  );
  assert.equal(under5.overtimeMultiplier, 1);
  assert.equal(under5.nightPremiumMultiplier, 0);
  assert.equal(under5.monthlyNight, 0);
  assert.equal(under5.monthlyOvertime, under5.monthlyOvertimeHours * MIN_WAGE_2026);

  // 5인 미만이라도 주휴수당·최저임금은 그대로 적용된다
  assert.equal(under5.monthlyHoliday, fivePlus.monthlyHoliday);
});

test("수습기간 90% 적용 시 시급의 90%로 계산한다", () => {
  const r = calcPay(base({ probation: true, breakMinutes: 0 }));
  assert.equal(r.effectiveWage, Math.floor(MIN_WAGE_2026 * 0.9));
  assert.equal(r.effectiveWage, 9288);
  assert.equal(r.gross, 209 * 9288);
});

test("주당 총 시간 직접입력 모드와 입력값 보정", () => {
  const direct = calcPay(base({ useDirectHours: true, directWeeklyHours: 18 }));
  assert.equal(direct.weeklyHours, 18);
  assert.equal(direct.monthlyBaseHours, 78); // 18 × 4.345 = 78.2 → 78
  assert.equal(direct.weeklyHolidayHours, 3.6);

  // 음수·과도한 값은 보정한다
  assert.equal(calcWeeklyHours(base({ useDirectHours: true, directWeeklyHours: -5 })), 0);
  assert.equal(calcWeeklyHours(base({ useDirectHours: true, directWeeklyHours: 500 })), 168);
  assert.equal(calcWeeklyHours(base({ breakMinutes: 1000 })), 0);
});

test("실제 입금액 비교 — 부족/일치/초과", () => {
  const expected = 2_000_000;

  const short = compareRealPay(expected, 1_850_000);
  assert.equal(short.status, "short");
  assert.equal(short.gap, 150_000);
  assert.equal(short.diff, -150_000);

  const exact = compareRealPay(expected, 2_000_000);
  assert.equal(exact.status, "exact");
  assert.equal(exact.gap, 0);

  const over = compareRealPay(expected, 2_120_000);
  assert.equal(over.status, "over");
  assert.equal(over.gap, 120_000);
});

test("월평균 주 수 상수는 365/12/7", () => {
  assert.ok(Math.abs(WEEKS_PER_MONTH - 4.345238) < 0.000001);
});
