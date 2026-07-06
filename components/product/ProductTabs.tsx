"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_CONTENT: Record<string, string> = {
  description: "No description available for this product yet.",
  dosage: "Follow the directions on the packaging, or ask your pharmacist for guidance.",
  ingredients: "Ingredient information is not available for this product yet.",
  warnings: "Keep out of reach of children. Consult your pharmacist if you have any concerns.",
  storage: "Store in a cool, dry place, away from direct sunlight.",
};

interface ProductTabsProps {
  description?: string | null;
  dosage?: string | null;
  ingredients?: string | null;
  warnings?: string | null;
  storage?: string | null;
}

export default function ProductTabs({ description, dosage, ingredients, warnings, storage }: ProductTabsProps) {
  const TABS = [
    { id: "description", label: "Description", content: description || DEFAULT_CONTENT.description },
    { id: "dosage", label: "Dosage & usage", content: dosage || DEFAULT_CONTENT.dosage },
    { id: "ingredients", label: "Ingredients", content: ingredients || DEFAULT_CONTENT.ingredients },
    { id: "warnings", label: "Warnings & side effects", content: warnings || DEFAULT_CONTENT.warnings },
    { id: "storage", label: "Storage", content: storage || DEFAULT_CONTENT.storage },
  ];

  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [openAccordion, setOpenAccordion] = useState<string | null>(TABS[0].id);

  const activeContent = TABS.find((t) => t.id === activeTab)?.content ?? TABS[0].content;

  return (
    <div>
      {/* Desktop / tablet: underline tabs */}
      <div className="hidden md:block">
        <div className="flex gap-7 overflow-x-auto border-b border-neutral-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 border-b-2 py-3.5 font-label text-sm font-semibold whitespace-nowrap ${
                activeTab === t.id ? "border-primary-500 text-neutral-900" : "border-transparent text-neutral-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="max-w-[760px] py-6 text-[14.5px] leading-[1.7] text-neutral-700">{activeContent}</div>
      </div>

      {/* Mobile: accordion */}
      <div className="flex flex-col border-t border-neutral-200 md:hidden">
        {TABS.map((t) => {
          const open = openAccordion === t.id;
          return (
            <div key={t.id} className="border-b border-neutral-200">
              <button
                type="button"
                onClick={() => setOpenAccordion(open ? null : t.id)}
                className="flex w-full items-center justify-between py-4 text-left"
              >
                <span className="font-headline text-[15px] font-bold text-neutral-900">{t.label}</span>
                {open ? (
                  <ChevronUp className="h-[18px] w-[18px] text-neutral-500" />
                ) : (
                  <ChevronDown className="h-[18px] w-[18px] text-neutral-500" />
                )}
              </button>
              {open && <div className="pb-[18px] text-sm leading-[1.7] text-neutral-700">{t.content}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
