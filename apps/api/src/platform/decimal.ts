import Decimal from 'decimal.js';

/** Exact arithmetic for money, marks and percentages. Never use JS floats for these. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export const dec = (v: Decimal.Value | null | undefined): Dec => new D(v ?? 0);

export const money = (v: Decimal.Value) => new D(v).toFixed(2);

export const sum = (values: Array<Decimal.Value | null | undefined>) =>
  values.reduce<Dec>((acc, v) => acc.plus(v ?? 0), new D(0));

export const min = (a: Decimal.Value, b: Decimal.Value) => (new D(a).lt(b) ? new D(a) : new D(b));
export const max = (a: Decimal.Value, b: Decimal.Value) => (new D(a).gt(b) ? new D(a) : new D(b));
