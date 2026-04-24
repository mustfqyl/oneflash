import { describe, expect, it, vi } from "vitest";
import {
  isRetriableDatabaseError,
  withDatabaseRetry,
} from "@/lib/database";

describe("database helpers", () => {
  it("detects retriable Prisma connectivity errors", () => {
    expect(
      isRetriableDatabaseError({
        code: "P1001",
        message: "Can't reach database server at aws-1-eu-central-1.pooler.supabase.com",
      })
    ).toBe(true);

    expect(
      isRetriableDatabaseError(new Error("read EHOSTUNREACH"))
    ).toBe(true);

    expect(
      isRetriableDatabaseError({
        code: "P2002",
        message: "Unique constraint failed",
      })
    ).toBe(false);
  });

  it("retries transient database errors before succeeding", async () => {
    vi.useFakeTimers();

    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({
        code: "P1001",
        message: "Can't reach database server",
      })
      .mockResolvedValueOnce("ok");

    const resultPromise = withDatabaseRetry(operation, {
      retries: 2,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
