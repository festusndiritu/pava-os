import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, registerDecorator, ValidationOptions } from 'class-validator';

const KENYAN_MOBILE = /^(07|01)\d{8}$/;

/**
 * Normalizes a Kenyan mobile number to the local 10-digit 07xx/01xx form
 * that the rest of the system stores, searches and prints on receipts.
 * Accepts the forms people actually type or paste — with or without a
 * +254/254 country code, with spaces, dashes or brackets — and leaves
 * anything it can't confidently parse untouched so IsKenyanPhone reports
 * it rather than silently keeping a mangled value.
 */
export function normalizeKenyanPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  const withCountryCode = digitsOnly.match(/^\+?254(7\d{8}|1\d{8})$/);
  if (withCountryCode) return `0${withCountryCode[1]}`;
  return digitsOnly;
}

/**
 * Kenyan mobile number: exactly 10 digits, starting 07 or 01 — Safaricom,
 * Airtel and Telkom ranges all fall under 07, and the newer numbering
 * (Faiba, additional Safaricom/Airtel blocks) under 01. Landlines and
 * anything else are out of scope; every phone field in this system is a
 * mobile someone is actually called or M-Pesa'd on.
 */
export function IsKenyanPhone(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isKenyanPhone',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: 'Enter a valid Kenyan phone number (10 digits, starting 07 or 01)',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && KENYAN_MOBILE.test(value);
        },
      },
    });
  };
}

/**
 * Composite for the common case — an optional phone field: normalizes
 * whatever was typed, then validates the result. Every phone/altPhone
 * field in the system is optional (no document requires one to be
 * raised), so this is the one to reach for; use IsOptional + the two
 * pieces above directly only if a field is ever made required.
 */
export function OptionalKenyanPhone(validationOptions?: ValidationOptions) {
  return applyDecorators(
    IsOptional(),
    Transform(({ value }) => normalizeKenyanPhone(value)),
    IsKenyanPhone(validationOptions),
  );
}
