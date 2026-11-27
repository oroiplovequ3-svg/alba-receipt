/**
 * 알바영수증 — 급여 계산 로직 (순수 함수)
 *
 * 기준(2026년):
 *  - 최저임금: 시급 10,320원 (고용노동부 고시, 2026.1.1~12.31), 월 209시간 환산 2,156,880원
 *  - 2027년 최저임금: 시급 10,700원 (고시 제2026-60호), 월 2,236,300원
 *  - 4대보험 근로자 부담: 국민연금 4.75% + 건강보험 3.595% + 장기요양(건강보험료의 13.14%) + 고용보험 0.9%
 *  - 주휴수당: 1주 소정근로시간 15시간 이상 & 소정근로일 개근 시, (주 소정근로시간 ÷ 40) × 8시간 × 시급 (최대 8시간)
 *  - 가산수당: 5인 이상 사업장에서 연장·야간(22:00~06:00) 근로 시 통상임금의 50% 이상 가산
 */

export const MIN_WAGE_2026 = 10_320;
export const MIN_WAGE_2027 = 10_700;
export const MIN_WAGE_2026_MONTHLY = 2_156_880; // 209시간 기준
export const MIN_WAGE_2027_MONTHLY = 2_236_300; // 209시간 기준

/** 월평균 주 수 = 365일 ÷ 12개월 ÷ 7일 */
export const WEEKS_PER_MONTH = 365 / 12 / 7; // ≈ 4.3452

export const HOLIDAY_PAY_MIN_WEEKLY_HOURS = 15;

/** 2026년 4대보험 근로자 부담률 */
export const INSURANCE_RATES = {
  pension: 0.0475, // 국민연금
  health: 0.03595, // 건강보험
  longTermCare: 0.03595 * 0.1314, // 장기요양보험 = 건강보험료 × 13.14%
  employment: 0.009, // 고용보험(실업급여)
} as const;

export const INSURANCE_TOTAL_RATE =
  INSURANCE_RATES.pension +
  INSURANCE_RATES.health +
  INSURANCE_RATES.longTermCare +
  INSURANCE_RATES.employment; // ≈ 0.097174 (9.7%)

export const FREELANCER_INCOME_TAX_RATE = 0.03;
export const FREELANCER_LOCAL_TAX_RATE = 0.003;

export type TaxType = "freelancer" | "insurance" | "none";

export interface PayInput {
  /** 시급(원) */
  hourlyWage: number;
  /** 주 근무일수 */
  weeklyDays: number;
  /** 하루 근무시간(휴게 포함, 시간) */
  dailyHours: number;
  /** 하루 휴게시간(무급, 분) */
  breakMinutes: number;
  /** 주당 총 근무시간 직접 입력 사용 여부 */
  useDirectHours: boolean;
  /** 직접 입력한 주당 총 근무시간(휴게 제외, 시간) */
  directWeeklyHours: number;
  taxType: TaxType;
  /** 수습기간(최저임금 90%) 적용 */
  probation: boolean;
  /** 5인 이상 사업장 (가산수당 의무) */
  fiveOrMoreEmployees: boolean;
  /** 주 연장근로시간 */
  overtimeHours: number;
  /** 주 야간근로시간(22:00~06:00) */
  nightHours: number;
}

export interface DeductionLine {
  key: "incomeTax" | "localTax" | "pension" | "health" | "longTermCare" | "employment";
  label: string;
  rate: number;
  amount: number;
}

export interface PayResult {
  /** 계산 모드 — 간편 평균(4.345주) */
  mode: "simple";
  effectiveWage: number;
  probationApplied: boolean;
  /** 하루 실근로시간(휴게 제외) */
  dailyRealHours: number;
  /** 주 소정근로시간(휴게 제외) */
  weeklyHours: number;
  /** 월 환산 소정근로시간(기본급 기준, 반올림) */
  monthlyBaseHours: number;
  /** 월 환산 주휴시간 */
  monthlyHolidayHours: number;
  /** 월 환산 연장근로시간 */
  monthlyOvertimeHours: number;
  /** 월 환산 야간근로시간 */
  monthlyNightHours: number;
  /** 월 환산 근로시간 합계(소정 + 주휴) */
  monthlyHours: number;
  holidayEligible: boolean;
  /** 주당 주휴시간 */
  weeklyHolidayHours: number;
  monthlyBase: number;
  monthlyOvertime: number;
  monthlyNight: number;
  monthlyHoliday: number;
  /** 세전 총액 */
  gross: number;
  deductions: DeductionLine[];
  totalDeduction: number;
  /** 예상 실수령액 */
  net: number;
  /** 4대보험·세금 반영 후 실질 시급 */
  hourlyNet: number;
  /** 연장근로 배율 (5인 이상 1.5 / 미만 1.0) */
  overtimeMultiplier: number;
  /** 야간근로 가산 배율 (5인 이상 0.5 / 미만 0) */
  nightPremiumMultiplier: number;
}

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const roundWon = (value: number) => Math.round(value);

/** 주 소정 실근로시간 (휴게시간 제외, 최대 168시간) */
export function calcWeeklyHours(input: PayInput): number {
  if (input.useDirectHours) {
    return clamp(input.directWeeklyHours, 0, 168);
  }
  const dailyReal = Math.max(0, input.dailyHours - Math.max(0, input.breakMinutes) / 60);
  return clamp(dailyReal * clamp(input.weeklyDays, 0, 7), 0, 168);
}

/** 하루 실근로시간 (휴게 제외) */
export function calcDailyRealHours(input: PayInput): number {
  return Math.max(0, input.dailyHours - Math.max(0, input.breakMinutes) / 60);
}

export function calcPay(input: PayInput): PayResult {
  const wage = Math.max(0, Math.floor(input.hourlyWage) || 0);
  const probationApplied = input.probation;
  const effectiveWage = probationApplied ? Math.floor(wage * 0.9) : wage;

  const weeklyHours = calcWeeklyHours(input);
  const dailyRealHours = calcDailyRealHours(input);

  const weeklyHolidayHours = Math.min((weeklyHours / 40) * 8, 8);
  const holidayEligible = weeklyHours >= HOLIDAY_PAY_MIN_WEEKLY_HOURS;

  // 월 환산은 시간 단위로 반올림한다.
  // 주 40시간이면 기본급 174시간 + 주휴 35시간 = 209시간으로, 최저임금 월 환산액(209시간)과 일치한다.
  const monthlyBaseHours = Math.round(weeklyHours * WEEKS_PER_MONTH);
  const monthlyHolidayHours = holidayEligible ? Math.round(weeklyHolidayHours * WEEKS_PER_MONTH) : 0;
  const monthlyOvertimeHours = Math.round(clamp(input.overtimeHours, 0, 168) * WEEKS_PER_MONTH);
  const monthlyNightHours = Math.round(clamp(input.nightHours, 0, 168) * WEEKS_PER_MONTH);
  const monthlyHours = monthlyBaseHours + monthlyHolidayHours;

  const fivePlus = input.fiveOrMoreEmployees;
  const overtimeMultiplier = fivePlus ? 1.5 : 1;
  const nightPremiumMultiplier = fivePlus ? 0.5 : 0;

  const monthlyBase = monthlyBaseHours * effectiveWage;
  const monthlyOvertime = roundWon(monthlyOvertimeHours * effectiveWage * overtimeMultiplier);
  const monthlyNight = roundWon(monthlyNightHours * effectiveWage * nightPremiumMultiplier);
  const monthlyHoliday = monthlyHolidayHours * effectiveWage;

  const gross = monthlyBase + monthlyOvertime + monthlyNight + monthlyHoliday;

  const { deductions, totalDeduction } = calcDeductions(gross, input.taxType);
  const net = gross - totalDeduction;
  const totalMonthlyHours = monthlyHours + monthlyOvertimeHours + monthlyNightHours;
  const hourlyNet = totalMonthlyHours > 0 ? net / totalMonthlyHours : 0;

  return {
    mode: "simple",
    effectiveWage,
    probationApplied,
    dailyRealHours,
    weeklyHours,
    monthlyBaseHours,
    monthlyHolidayHours,
    monthlyOvertimeHours,
    monthlyNightHours,
    monthlyHours,
    holidayEligible,
    weeklyHolidayHours,
    monthlyBase,
    monthlyOvertime,
    monthlyNight,
    monthlyHoliday,
    gross,
    deductions,
    totalDeduction,
    net,
    hourlyNet,
    overtimeMultiplier,
    nightPremiumMultiplier,
  };
}

/** 세전 급여에서 세금·4대보험 근로자 부담분을 계산한다. */
export function calcDeductions(
  gross: number,
  taxType: TaxType,
): { deductions: DeductionLine[]; totalDeduction: number } {
  const deductions: DeductionLine[] = [];
  if (taxType === "freelancer") {
    deductions.push({
      key: "incomeTax",
      label: "소득세 (3%)",
      rate: FREELANCER_INCOME_TAX_RATE,
      amount: roundWon(gross * FREELANCER_INCOME_TAX_RATE),
    });
    deductions.push({
      key: "localTax",
      label: "지방소득세 (0.3%)",
      rate: FREELANCER_LOCAL_TAX_RATE,
      amount: roundWon(gross * FREELANCER_LOCAL_TAX_RATE),
    });
  } else if (taxType === "insurance") {
    deductions.push({
      key: "pension",
      label: "국민연금 (4.75%)",
      rate: INSURANCE_RATES.pension,
      amount: roundWon(gross * INSURANCE_RATES.pension),
    });
    deductions.push({
      key: "health",
      label: "건강보험 (3.595%)",
      rate: INSURANCE_RATES.health,
      amount: roundWon(gross * INSURANCE_RATES.health),
    });
    deductions.push({
      key: "longTermCare",
      label: "장기요양 (건보료의 13.14%)",
      rate: INSURANCE_RATES.longTermCare,
      amount: roundWon(gross * INSURANCE_RATES.longTermCare),
    });
    deductions.push({
      key: "employment",
      label: "고용보험 (0.9%)",
      rate: INSURANCE_RATES.employment,
      amount: roundWon(gross * INSURANCE_RATES.employment),
    });
  }

  const totalDeduction = deductions.reduce((sum, line) => sum + line.amount, 0);
  return { deductions, totalDeduction };
}

export type RealPayStatus = "short" | "exact" | "over";

export interface RealPayComparison {
  status: RealPayStatus;
  /** 실제 입금액 − 예상 실수령액 */
  diff: number;
  /** 차액의 절댓값 */
  gap: number;
  /** 예상 실수령액 대비 비율(%) */
  ratio: number;
}

const MATCH_TOLERANCE = 10;

export function compareRealPay(expectedNet: number, actualAmount: number): RealPayComparison {
  const diff = Math.round(actualAmount) - Math.round(expectedNet);
  const base = Math.max(1, Math.round(expectedNet));
  const status: RealPayStatus =
    Math.abs(diff) <= MATCH_TOLERANCE ? "exact" : diff < 0 ? "short" : "over";

  return {
    status,
    diff,
    gap: Math.abs(diff),
    ratio: (Math.abs(diff) / base) * 100,
  };
}

export const won = (value: number) => Math.round(value).toLocaleString("ko-KR");

export const WAGE_PRESETS = [
  {
    year: "2026",
    label: "2026 최저시급",
    hourly: MIN_WAGE_2026,
    monthly: MIN_WAGE_2026_MONTHLY,
  },
  {
    year: "2027",
    label: "2027 최저시급",
    hourly: MIN_WAGE_2027,
    monthly: MIN_WAGE_2027_MONTHLY,
  },
] as const;
