import type { LucideIcon } from "lucide-react";
import Card from "@/components/ui/Card";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  delta: string;
  deltaLabel: string;
  deltaTone: "success" | "danger";
}

export default function KpiCard({ label, value, icon: Icon, iconBg, iconColor, delta, deltaLabel, deltaTone }: KpiCardProps) {
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-label text-xs font-semibold tracking-wide text-neutral-500 uppercase">{label}</span>
          <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-[10px] ${iconBg}`}>
            <Icon className={`h-[15px] w-[15px] ${iconColor}`} strokeWidth={2} />
          </span>
        </div>
        <div className="font-headline text-2xl font-extrabold text-neutral-900">{value}</div>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-label text-xs font-semibold ${deltaTone === "success" ? "text-success-600" : "text-danger-600"}`}
          >
            {delta}
          </span>
          <span className="text-xs text-neutral-400">{deltaLabel}</span>
        </div>
      </div>
    </Card>
  );
}
