import Link from "next/link";
import { LogIn } from "lucide-react";
import Button from "@/components/ui/Button";
import CheckoutClient from "@/components/checkout/CheckoutClient";
import { getAddresses } from "@/lib/queries";

export default async function CheckoutPage() {
  const { addresses, isLoggedIn } = await getAddresses();

  if (!isLoggedIn) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
            <LogIn className="h-[34px] w-[34px] text-primary-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">Sign in to check out</div>
          <div className="max-w-[320px] text-sm text-neutral-500">
            Create an account or sign in to place your order — this also lets us save your addresses and order
            history for next time.
          </div>
          <Link href="/auth?redirect=/checkout">
            <Button variant="primary" size="lg">
              Sign in
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return <CheckoutClient addresses={addresses} />;
}
