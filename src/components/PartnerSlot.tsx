export function PartnerSlot() {
  return (
    <section
      aria-label="제휴 상품 안내 자리"
      className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-ink-faint">
          AD
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-ink-2">제휴 상품 자리 · 준비 중</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
            지금은 연결된 링크가 없어요. 제휴가 맺어지면 이 자리에 어떤 상품인지와 대가성 문구를 함께
            표시합니다.
          </p>
        </div>
      </div>
    </section>
  );
}
