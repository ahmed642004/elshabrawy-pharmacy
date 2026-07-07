import Link from "next/link";
import { LogIn } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";
import OrderHistoryClient from "@/components/account/OrderHistoryClient";
import { getMyOrders } from "@/lib/queries";

export default async function MyOrdersPage() {
  const { orders, isLoggedIn } = await getMyOrders();
  const t = await getTranslations("account");

  if (!isLoggedIn) {
    const tHeader = await getTranslations("header");
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-center gap-3.5 rounded-[28px] border border-neutral-200 bg-white px-6 py-12 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-tertiary-100">
            <LogIn className="h-[34px] w-[34px] text-primary-500" />
          </span>
          <div className="font-headline text-xl font-extrabold text-neutral-900">{t("ordersGateTitle")}</div>
          <div className="max-w-[320px] text-sm text-neutral-500">
            {t("ordersGateHint")}
          </div>
          <Link href="/auth?redirect=/account/orders">
            <Button variant="primary" size="lg">
              {tHeader("signIn")}
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
      <div>
        <h1 className="m-0 font-headline text-2xl font-extrabold tracking-tight text-neutral-900 md:text-[28px]">
          {t("ordersTitle")}
        </h1>
        <p className="m-0 mt-1 text-sm text-neutral-500">
          {t("ordersSubtitle", { count: orders.length })}
        </p>
      </div>
      <OrderHistoryClient orders={orders} />
    </main>
  );
}
