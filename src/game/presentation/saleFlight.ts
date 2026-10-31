/** A sale's coins (2026-10-31): they burst out of the miner, hang a moment and fly one after another into the money
 *  counter. The coins (MiningOverlay), the counter rolling up as they land (Hud) and the ticks they land with (the
 *  sell cue) keep this one timetable, in milliseconds from the sale. */
export const SALE_FLIGHT = {
  /** The burst out of the miner. */
  burst: 300,
  /** Each coin's flight into the counter. */
  flight: 480,
  /** The first coin lands; the last one `stream` later. */
  first: 880,
  stream: 620,
} as const;
/** More coins for a bigger sale: 6 for a handful of money, 14 from about a million. */
export const saleCoinCount = (coins: number) => Math.max(6, Math.min(14, Math.round(2 + 2 * Math.log10(Math.max(1, coins)))));
/** When the `i`th of `count` coins lands. */
export const saleLanding = (i: number, count: number) => SALE_FLIGHT.first + (count > 1 ? i / (count - 1) : 0) * SALE_FLIGHT.stream;
