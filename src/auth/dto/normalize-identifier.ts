import type { TransformFnParams } from 'class-transformer';

export function normalizeIdentifier({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
