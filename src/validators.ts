const ErrorCode = { InvalidParams: -32602 };

class McpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function validateString(
  value: unknown,
  field: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${field} is required and must be a non-empty string`
    );
  }
  return value.trim();
}

export function validateOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${field} must be a valid number`
    );
  }
  return value;
}

export function validateOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || isNaN(value)) return undefined;
  return value;
}

export function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim().length > 0);
}

export function validateOptionalStringArray(
  value: unknown
): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return validateStringArray(value);
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${field} must be a boolean`
    );
  }
  return value;
}

export function validateOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") return undefined;
  return value;
}

export function validateOptionalDateString(
  value: unknown
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Date must be in YYYY-MM-DD format"
    );
  }
  return trimmed;
}
