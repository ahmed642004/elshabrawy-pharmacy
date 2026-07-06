export default function StockProgressBar({
  stockCount,
  lowStockThreshold,
}: {
  stockCount: number;
  lowStockThreshold: number;
}) {
  const low = stockCount <= lowStockThreshold;
  const pct = Math.min(100, Math.round((stockCount / Math.max(1, lowStockThreshold * 3)) * 100));

  return (
    <div>
      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${low ? "bg-danger-500" : "bg-secondary-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-neutral-400">{stockCount} in stock</div>
    </div>
  );
}
