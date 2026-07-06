import { Plus } from "lucide-react";

const FOOTER_COLUMNS = [
  { title: "Shop", links: ["Skincare", "Vitamins & supplements", "Hair care", "Offers"] },
  { title: "Company", links: ["About us", "Careers", "Pharmacies near you"] },
  { title: "Support", links: ["Help center", "Track an order", "Ask a pharmacist"] },
  { title: "Legal", links: ["Privacy policy", "Terms of service", "Licensing"] },
];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white px-4 pt-7 md:px-10 md:pt-9">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-7 grid grid-cols-2 gap-7 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 font-headline text-[13px] font-bold tracking-wide text-neutral-900 uppercase">
                {col.title}
              </div>
              <div className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <span key={link} className="text-[13.5px] text-neutral-500">
                    {link}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-neutral-200 py-5 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-primary-500">
              <Plus className="h-4 w-4 text-white" />
            </span>
            <span className="text-[13px] text-neutral-500">
              © {new Date().getFullYear()} Elshabrawy Pharmacy. Licensed pharmacy, EDA-registered.
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] text-neutral-500">
            <span>Privacy policy</span>
            <span>Terms of service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
