import { registerDecorator, ValidationOptions } from 'class-validator';

/** A monetary amount in whole Kenyan shillings — no cents. */
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
