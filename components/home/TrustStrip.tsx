import { Truck, ShieldCheck, Clock, Headset, type LucideIcon } from "lucide-react";

interface TrustItem {
  icon: LucideIcon;
  title: string;
  sub: string;
}

const TRUST_ITEMS: TrustItem[] = [
  { icon: Truck, title: "Free delivery", sub: "On orders over EGP 300" },
  { icon: ShieldCheck, title: "Licensed pharmacy", sub: "Verified & regulated" },
  { icon: Clock, title: "2-hour delivery", sub: "Across Greater Cairo" },
  { icon: Headset, title: "Ask a pharmacist", sub: "Free chat, 24/7" },
];

export default function TrustStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {TRUST_ITEMS.map(({ icon: Icon, title, sub }) => (
        <div key={title} className="flex items-center gap-3.5 rounded-[14px] bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-tertiary-100 text-primary-500">
            <Icon className="h-[22px] w-[22px]" />
          </span>
          <div>
            <div className="font-headline text-[14.5px] font-bold text-neutral-900">{title}</div>
            <div className="text-[12.5px] text-neutral-500">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
