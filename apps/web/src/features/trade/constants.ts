/** The terminal's numbers. */

export const DEFAULT_LEVERAGE = 5;
export const MAINTENANCE_SHARE = 2;
export const EPSILON = 1e-9;
export const SHARES = [25, 50, 75, 100] as const;
export const PCT = 100;
export const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 25, 40, 50] as const;
export const SIZE_SIG = 5;
/** Take-profit and stop-loss presets, as a percent return on the margin. */
export const TP_PRESETS = [10, 25, 50, 100] as const;
export const SL_PRESETS = [10, 25, 50, 75] as const;
/** Margin amounts are typed to the cent. */
export const MARGIN_DECIMALS = 2;
