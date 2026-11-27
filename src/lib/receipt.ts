import { won, compareRealPay, type PayInput, type PayResult } from "./pay";

const TAX_LABEL: Record<PayInput["taxType"], string> = {
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
    return `주 ${won(input.directWeeklyHours)}시간 직접 입력`;
  }
  const hours = input.dailyHours % 1 === 0 ? input.dailyHours : input.dailyHours.toFixed(1);
  return `주 ${input.weeklyDays}일 · 하루 ${hours}시간(${formatBreak(input.breakMinutes)})`;
}

export function buildReceiptText(input: PayInput, result: PayResult, actualPay?: number | null): string {
  const lines: string[] = [];
  const now = new Date();
  const dateLabel = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;

  lines.push("🧾 알바영수증 — 이번 달 예상 급여 명세");
  lines.push("");
  lines.push(`· 시급: ${won(result.effectiveWage)}원${result.probationApplied ? " (수습 90% 적용)" : ""}`);
  lines.push(`· 근무: ${describeSchedule(input)} → 주 ${result.weeklyHours}시간`);
  lines.push(`· 공제: ${TAX_LABEL[input.taxType]}`);
  lines.push("--------------------------------");
  lines.push(`기본급 (${result.monthlyBaseHours}시간)  ${won(result.monthlyBase)}원`);
  lines.push(
    result.holidayEligible
      ? `주휴수당 (${result.monthlyHolidayHours}시간)  ${won(result.monthlyHoliday)}원`
      : "주휴수당  0원 (주 15시간 미만)",
  );
  if (result.monthlyOvertime > 0) {
    lines.push(
      `연장수당 (${result.monthlyOvertimeHours}시간 × ${result.overtimeMultiplier}배)  ${won(result.monthlyOvertime)}원`,
    );
  }
  if (result.monthlyNight > 0) {
    lines.push(
      `야간가산 (${result.monthlyNightHours}시간 × ${result.nightPremiumMultiplier}배)  ${won(result.monthlyNight)}원`,
    );
  }
  lines.push("--------------------------------");
  lines.push(`세전 합계  ${won(result.gross)}원`);
  result.deductions.forEach((d) => {
    lines.push(`${d.label}  -${won(d.amount)}원`);
  });
  if (result.deductions.length > 0) {
    lines.push(`공제 합계  -${won(result.totalDeduction)}원`);
  }
  lines.push("================================");
  lines.push(`★ 예상 실수령액  ${won(result.net)}원`);
  lines.push("--------------------------------");

  if (typeof actualPay === "number" && Number.isFinite(actualPay) && actualPay > 0) {
    const c = compareRealPay(result.net, actualPay);
    lines.push(`실제 입금액  ${won(actualPay)}원`);
    if (c.status === "exact") {
      lines.push("차액  0원 (예상과 일치)");
    } else {
      lines.push(
        `차액  ${c.diff > 0 ? "+" : "-"}${won(c.gap)}원 (${c.status === "short" ? "덜 받음" : "더 받음"})`,
      );
    }
    lines.push("--------------------------------");
  }

  lines.push(`생성일: ${dateLabel} · 알바영수증`);
  return lines.join("\n");
}

export function buildCheckMessage(input: PayInput, result: PayResult, actualPay: number): string {
  const c = compareRealPay(result.net, actualPay);
  const schedule = describeSchedule(input);

  const blocks: string[] = [];
  blocks.push("사장님, 안녕하세요. 급여 관련해서 확인 부탁드릴 게 있어 연락드립니다.");
  blocks.push("");
  blocks.push("제가 계산한 이번 달 예상 급여는 이렇습니다.");
  blocks.push(
    `· 근무 조건: ${schedule}, 시급 ${won(result.effectiveWage)}원${result.probationApplied ? " (수습 90%)" : ""}`,
  );
  blocks.push(`· 세전 급여: ${won(result.gross)}원 (기본급 + 주휴수당 포함)`);
  blocks.push(`· 공제: ${TAX_LABEL[input.taxType]} ${won(result.totalDeduction)}원`);
  blocks.push(`· 예상 실수령액: ${won(result.net)}원`);
  blocks.push("");
  blocks.push(
    `실제 입금된 금액은 ${won(actualPay)}원으로, 예상보다 ${won(c.gap)}원 적습니다. 급여명세서나 공제 내역을 한 번 확인해 주실 수 있을까요? 감사합니다.`,
  );
  return blocks.join("\n");
}
