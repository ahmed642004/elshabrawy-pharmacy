// Shared between the client (checkbox labels in FilterGroups/CategoryListingClient)
// and the server (lib/queries.ts builds a Postgrest filter from these bounds) so
// the two can't drift out of sync — one definition of what each price bucket means.
export interface PriceRangeDef {
  id: string;
  label: string;
  min?: number;
  minExclusive?: boolean;
  max?: number;
  maxExclusive?: boolean;
}

export const PRICE_RANGES: PriceRangeDef[] = [
  { id: "r1", label: "Under EGP 100", max: 100, maxExclusive: true },
  { id: "r2", label: "EGP 100 – 300", min: 100, max: 300 },
  { id: "r3", label: "EGP 300 – 600", min: 300, minExclusive: true, max: 600 },
  { id: "r4", label: "Over EGP 600", min: 600, minExclusive: true },
];
