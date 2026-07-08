// Templates remount on every navigation, giving each shop page a subtle
// fade-up entrance. Header/Footer live in layout.tsx above this, so they
// (and their state) are unaffected.
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col" style={{ animation: "heroFadeUp 250ms ease-out both" }}>{children}</div>;
}
