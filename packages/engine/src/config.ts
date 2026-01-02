export type EngineConfig = {
  /**
   * Minimum bid target. When the bidder team declares royals, the target is
   * reduced by `royalsAdjustment` but never below this floor.
   */
  minBid: number;
  /**
   * Maximum bid target after defender royals. When the defending team declares
   * royals, the target is increased by `royalsAdjustment` but never above this
   * cap (use 29 when last trick bonus is ON).
   */
  maxBidTarget: number;
  /**
   * The absolute royals adjustment amount (use 4 for Twenty-Nine).
   */
  royalsAdjustment: number;
  /**
   * Who leads the first trick after trump selection.
   */
  openingLead: "left-of-dealer" | "bidder";
};
