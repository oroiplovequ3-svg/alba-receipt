import {
  compareRealPay,
  type DeductionLine,
  type PayInput,
  type PayResult,
  type TaxType,
} from "./pay.ts";
import type { CalendarPayResult, CalendarInput } from "./calendar.ts";
import { hoursText } from "./calendar.ts";

export interface PaySummary {
  mode: "simple" | "calendar";
  /** "월 환산 (4.345주)" / "2026년 11월 달력" */
  periodLabel: string;
  /** 근무 조건 한 줄 */
  scheduleLabel: string;
  effectiveWage: number;
  probationApplied: boolean;
  /** 기본급 시간 */
  baseHours: number;
  basePay: number;
  holidayEligible: boolean;
  holidayHours: number;
  holidayPay: number;
  holidayNote: string;
  overtimeHours: number;
  overtimePay: number;
  overtimeMultiplier: number;
  nightHours: number;
  nightPay: number;
  nightPremiumMultiplier: number;
  gross: number;
  deductions: DeductionLine[];
  totalDeduction: number;
  net: number;
  hourlyNet: number;
  taxType: TaxType;
  /** 실제 근무일수(달력 모드) */
  workDays?: number;
}

export const TAX_LABEL: Record<TaxType, string> = {
  freelancer: "3.3% 원천징수",
  insurance: "4대보험 9.7%",
  none: "미적용(0%)",
};

export function formatBreak(minutes: number): string {
  if (minutes <= 0) return "휴게 없음";
  if (minutes % 60 === 0) return `휴게 ${minutes / 60}시간`;
  return `휴게 ${minutes}분`;
}

export function describeSchedule(input: PayInput): string {
  if (input.useDirectHours) {
    return `주 ${input.directWeeklyHours}시간 직접 입력`;
  }
  const hours = input.dailyHours % 1 === 0 ? input.dailyHours : input.dailyHours.toFixed(1);
  return `주 ${input.weeklyDays}일 · 하루 ${hours}시간(${formatBreak(input.breakMinutes)})`;
}

export function simpleSummary(input: PayInput, result: PayResult): PaySummary {
  return {
    mode: "simple",
    periodLabel: "월 환산 (4.345주)",
    scheduleLabel: describeSchedule(input),
    effectiveWage: result.effectiveWage,
    probationApplied: result.probationApplied,
    baseHours: result.monthlyBaseHours,
    basePay: result.monthlyBase,
    holidayEligible: result.holidayEligible,
    holidayHours: result.monthlyHolidayHours,
    holidayPay: result.monthlyHoliday,
    holidayNote: result.holidayEligible
      ? "주 15시간 이상 · 개근 가정"
      : "주 15시간 미만",
    overtimeHours: result.monthlyOvertimeHours,
    overtimePay: result.monthlyOvertime,
    overtimeMultiplier: result.overtimeMultiplier,
    nightHours: result.monthlyNightHours,
    nightPay: result.monthlyNight,
    nightPremiumMultiplier: result.nightPremiumMultiplier,
    gross: result.gross,
    deductions: result.deductions,
    totalDeduction: result.totalDeduction,
    net: result.net,
    hourlyNet: result.hourlyNet,
    taxType: input.taxType,
  };
}

export function calendarSummary(input: CalendarInput, result: CalendarPayResult): PaySummary {
  return {
    mode: "calendar",
    periodLabel: `${result.year}년 ${result.month}월 달력`,
    scheduleLabel: `${result.workDays}일 근무 · ${hoursText(result.baseHours)}시간`,
    effectiveWage: result.effectiveWage,
    probationApplied: result.probationApplied,
    baseHours: result.baseHours,
    basePay: result.basePay,
    holidayEligible: result.holidayEligible,
    holidayHours: result.holidayHours,
    holidayPay: result.holidayPay,
    holidayNote: result.holidayNote,
    overtimeHours: result.overtimeHours,
    overtimePay: result.overtimePay,
    overtimeMultiplier: result.overtimeMultiplier,
    nightHours: result.nightHours,
    nightPay: result.nightPay,
    nightPremiumMultiplier: result.nightPremiumMultiplier,
    gross: result.gross,
    deductions: result.deductions,
    totalDeduction: result.totalDeduction,
    net: result.net,
    hourlyNet: result.hourlyNet,
    taxType: result.taxType,
    workDays: result.workDays,
  };
}

const dateLabel = (now: Date = new Date()) =>
  `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;

export function buildReceiptText(summary: PaySummary, actualPay?: number | null): string {
  const lines: string[] = [];
  lines.push(
    summary.mode === "calendar"
      ? `🧾 알바영수증 — ${summary.periodLabel} 예상 급여 명세`
      : "🧾 알바영수증 — 이번 달 예상 급여 명세",
  );
  lines.push("");
  lines.push(
    `· 시급: ${Math.round(summary.effectiveWage).toLocaleString("ko-KR")}원${
      summary.probationApplied ? " (수습 90% 적용)" : ""
    }`,
  );
  lines.push(`· 근무: ${summary.scheduleLabel} (${summary.periodLabel})`);
  lines.push(`· 공제: ${TAX_LABEL[summary.taxType]}`);
  lines.push("--------------------------------");
  lines.push(
    `기본급 (${hoursText(summary.baseHours)}시간)  ${Math.round(summary.basePay).toLocaleString("ko-KR")}원`,
  );
  lines.push(
    summary.holidayEligible
      ? `주휴수당 (${hoursText(summary.holidayHours)}시간 · ${summary.holidayNote})  ${Math.round(
          summary.holidayPay,
        ).toLocaleString("ko-KR")}원`
      : `주휴수당  0원 (${summary.holidayNote})`,
  );
  if (summary.overtimePay > 0) {
    lines.push(
      `연장수당 (${hoursText(summary.overtimeHours)}시간 × ${summary.overtimeMultiplier}배)  ${Math.round(
        summary.overtimePay,
      ).toLocaleString("ko-KR")}원`,
    );
  }
  if (summary.nightPay > 0) {
    lines.push(
      `야간가산 (${hoursText(summary.nightHours)}시간 × ${summary.nightPremiumMultiplier}배)  ${Math.round(
        summary.nightPay,
      ).toLocaleString("ko-KR")}원`,
    );
  }
  lines.push("--------------------------------");
  lines.push(`세전 합계  ${Math.round(summary.gross).toLocaleString("ko-KR")}원`);
  summary.deductions.forEach((d) => {
    lines.push(`${d.label}  -${d.amount.toLocaleString("ko-KR")}원`);
  });
  if (summary.deductions.length > 0) {
    lines.push(`공제 합계  -${Math.round(summary.totalDeduction).toLocaleString("ko-KR")}원`);
  }
  lines.push("================================");
  lines.push(`★ 예상 실수령액  ${Math.round(summary.net).toLocaleString("ko-KR")}원`);
  lines.push("--------------------------------");

  if (typeof actualPay === "number" && Number.isFinite(actualPay) && actualPay > 0) {
    const c = compareRealPay(summary.net, actualPay);
    lines.push(`실제 입금액  ${Math.round(actualPay).toLocaleString("ko-KR")}원`);
    if (c.status === "exact") {
      lines.push("차액  0원 (예상과 일치)");
    } else {
      lines.push(
        `차액  ${c.diff > 0 ? "+" : "-"}${c.gap.toLocaleString("ko-KR")}원 (${
          c.status === "short" ? "덜 받음" : "더 받음"
        })`,
      );
    }
    lines.push("--------------------------------");
  }

  lines.push(`생성일: ${dateLabel()} · 알바영수증`);
  return lines.join("\n");
}

export function buildCheckMessage(summary: PaySummary, actualPay: number): string {
  const c = compareRealPay(summary.net, actualPay);
  const blocks: string[] = [];
  blocks.push("사장님, 안녕하세요. 급여 관련해서 확인 부탁드릴 게 있어 연락드립니다.");
  blocks.push("");
  blocks.push("제가 계산한 이번 달 예상 급여는 이렇습니다.");
  blocks.push(
    `· 근무 조건: ${summary.scheduleLabel} (${summary.periodLabel}), 시급 ${Math.round(
      summary.effectiveWage,
    ).toLocaleString("ko-KR")}원${summary.probationApplied ? " (수습 90%)" : ""}`,
  );
  blocks.push(
    `· 세전 급여: ${Math.round(summary.gross).toLocaleString("ko-KR")}원 (기본급 + 주휴수당 포함)`,
  );
  blocks.push(
    `· 공제: ${TAX_LABEL[summary.taxType]} ${Math.round(summary.totalDeduction).toLocaleString("ko-KR")}원`,
  );
  blocks.push(`· 예상 실수령액: ${Math.round(summary.net).toLocaleString("ko-KR")}원`);
  blocks.push("");
  blocks.push(
    `실제 입금된 금액은 ${Math.round(actualPay).toLocaleString("ko-KR")}원으로, 예상보다 ${c.gap.toLocaleString(
      "ko-KR",
    )}원 적습니다. 급여명세서나 공제 내역을 한 번 확인해 주실 수 있을까요? 감사합니다.`,
  );
  return blocks.join("\n");
}
