const RETRIABLE_DATABASE_ERROR_CODES = new Set(["P1001", "EHOSTUNREACH"]);

function extractErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }

  return null;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function isRetriableDatabaseError(error: unknown) {
  const code = extractErrorCode(error);
  if (code && RETRIABLE_DATABASE_ERROR_CODES.has(code)) {
    return true;
  }

  const message = extractErrorMessage(error);
  return (
    message.includes("DatabaseNotReachable") ||
    message.includes("Can't reach database server") ||
    message.includes("read EHOSTUNREACH")
  );
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; delayMs?: number }
) {
  const retries = options?.retries ?? 2;
  const delayMs = options?.delayMs ?? 250;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetriableDatabaseError(error) || attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
