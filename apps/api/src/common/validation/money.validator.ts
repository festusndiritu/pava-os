import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * A monetary amount in whole Kenyan shillings — no cents. PAVA never sells
 * a fraction of a shilling, so a decimal here is always either a typo or a
 * per-unit price meant for a fractional quantity the yard doesn't sell
 * either (see IsWholeQuantity). Rejects a decimal rather than silently
 * rounding it away, so the person sees their own number reflected back,
 * not one Claude rounded for them.
 *
 * `allowNegative` is for signed fields — a balance adjustment or a payroll
 * "adjustments" line can be a deduction. Everything else defaults to
 * non-negative. `max` guards against a stray extra digit turning a normal
 * sale into an eight-figure invoice.
 */
export function IsMoney(
  options: { allowNegative?: boolean; max?: number } = {},
  validationOptions?: ValidationOptions,
) {
  const { allowNegative = false, max = 50_000_000 } = options;
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMoney',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a whole${allowNegative ? '' : ', non-negative'} number of shillings`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'number' || !Number.isFinite(value)) return false;
          if (!Number.isInteger(value)) return false;
          if (!allowNegative && value < 0) return false;
          return Math.abs(value) <= max;
        },
      },
    });
  };
}
