// Shared between the client (checkbox filters in FilterGroups/CategoryListingClient)
// and the server (lib/queries.ts builds a Postgrest filter from these bounds) so
// the two can't drift out of sync — one definition of what each price bucket means.
// Display labels live in messages/{locale}.json under listing.priceRanges keyed
// by these ids, so this file stays pure filter logic.
export interface PriceRangeDef {
  id: string;
  min?: number;
  minExclusive?: boolean;
  max?: number;
  maxExclusive?: boolean;
}

export const PRICE_RANGES: PriceRangeDef[] = [
  { id: "r1", max: 100, maxExclusive: true },
  { id: "r2", min: 100, max: 300 },
  { id: "r3", min: 300, minExclusive: true, max: 600 },
  { id: "r4", min: 600, minExclusive: true },
];
