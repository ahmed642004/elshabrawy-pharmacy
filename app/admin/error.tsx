"use client";

import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";

// Admin is deliberately English/LTR (repo rule) — no next-intl here.
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-50">
          <AlertTriangle className="h-[34px] w-[34px] text-danger-500" />
        </span>
        <div className="font-headline text-xl font-extrabold text-neutral-900">Something went wrong</div>
        <div className="max-w-[320px] text-sm text-neutral-500">
          An unexpected error occurred while loading this page.
        </div>
        <Button variant="primary" size="lg" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
