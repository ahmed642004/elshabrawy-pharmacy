import { Truck, ShieldCheck, Clock, Headset, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const TRUST_ITEMS: { icon: LucideIcon; titleKey: string; subKey: string }[] = [
  { icon: Truck, titleKey: "delivery", subKey: "deliverySub" },
  { icon: ShieldCheck, titleKey: "licensed", subKey: "licensedSub" },
  { icon: Clock, titleKey: "fast", subKey: "fastSub" },
  { icon: Headset, titleKey: "ask", subKey: "askSub" },
];

export default function TrustStrip() {
  const t = useTranslations("home.trust");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {TRUST_ITEMS.map(({ icon: Icon, titleKey, subKey }) => (
        <div key={titleKey} className="flex items-center gap-3.5 rounded-[14px] bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-tertiary-100 text-primary-500">
            <Icon className="h-[22px] w-[22px]" />
          </span>
          <div>
            <div className="font-headline text-[14.5px] font-bold text-neutral-900">{t(titleKey)}</div>
            <div className="text-[12.5px] text-neutral-500">{t(subKey)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
