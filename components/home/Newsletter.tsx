import { Mail } from "lucide-react";
import Button from "@/components/ui/Button";

export default function Newsletter() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-primary-100 bg-tertiary-100 px-5 py-7 md:flex-row md:items-center md:px-11 md:py-9">
      <div>
        <div className="mb-1.5 font-headline text-xl font-extrabold text-neutral-900">
          Health tips, straight to your inbox
        </div>
        <div className="text-sm text-neutral-500">
          Reminders, offers, and pharmacist-approved advice. No spam.
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <div className="flex h-11 items-center gap-2 rounded-[10px] border border-neutral-300 bg-white px-4 sm:w-64">
          <Mail className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
          <input
            type="email"
            placeholder="Your email address"
            className="h-full w-full min-w-0 border-none bg-transparent font-body text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>
        <Button variant="primary" size="md" className="w-full sm:w-auto">
          Subscribe
        </Button>
      </div>
    </div>
  );
}
