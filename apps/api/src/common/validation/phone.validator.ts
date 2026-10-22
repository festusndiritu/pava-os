import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, registerDecorator, ValidationOptions } from 'class-validator';

const KENYAN_MOBILE = /^(07|01)\d{8}$/;

/** Normalizes a Kenyan mobile number to the local 10-digit 07xx/01xx form that the rest of the system stores, searches and prints on receipts. */
export function normalizeKenyanPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  const withCountryCode = digitsOnly.match(/^\+?254(7\d{8}|1\d{8})$/);
  if (withCountryCode) return `0${withCountryCode[1]}`;
  return digitsOnly;
}

export function normalizePhoneSearch(term: string): string {
  const t = term.trim();
  if (!/^[+\d\s\-()]+$/.test(t)) return t;
  const digits = t.replace(/[\s\-()]/g, '');
  const withCountryCode = digits.match(/^\+?254(\d*)$/);
  return withCountryCode ? `0${withCountryCode[1]}` : digits;
}

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

/** Composite for the common case — an optional phone field: normalizes whatever was typed, then validates the result. */
export function OptionalKenyanPhone(validationOptions?: ValidationOptions) {
  return applyDecorators(
    IsOptional(),
    Transform(({ value }) => normalizeKenyanPhone(value)),
    IsKenyanPhone(validationOptions),
  );
}
