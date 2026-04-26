import { describe, expect, it } from "vitest";
import { getUploadTuning } from "@/lib/upload-tuning";

describe("getUploadTuning", () => {
  it("uses aggressive chunk sizes and worker counts on fast connections", () => {
    expect(
      getUploadTuning(8, {
        effectiveType: "4g",
        downlinkMbps: 80,
        hardwareConcurrency: 8,
      })
    ).toEqual({
      googleChunkSize: 64 * 1024 * 1024,
      onedriveChunkSize: 320 * 1024 * 160,
      maxParallelUploads: 6,
      sessionPrewarmLimit: 8,
      sessionBatchSize: 8,
    });
  });

  it("backs off on constrained networks", () => {
    expect(
      getUploadTuning(5, {
        effectiveType: "3g",
        downlinkMbps: 4,
        hardwareConcurrency: 4,
      })
    ).toEqual({
      googleChunkSize: 16 * 1024 * 1024,
      onedriveChunkSize: 320 * 1024 * 64,
      maxParallelUploads: 3,
      sessionPrewarmLimit: 5,
      sessionBatchSize: 5,
    });
  });

  it("caps parallel uploads to the number of files", () => {
    expect(
      getUploadTuning(1, {
        effectiveType: "4g",
        downlinkMbps: 80,
        hardwareConcurrency: 12,
      })
    ).toEqual({
      googleChunkSize: 64 * 1024 * 1024,
      onedriveChunkSize: 320 * 1024 * 160,
      maxParallelUploads: 1,
      sessionPrewarmLimit: 1,
      sessionBatchSize: 1,
    });
  });

  it("keeps a deeper warmed session buffer for large fast queues", () => {
    expect(
      getUploadTuning(32, {
        effectiveType: "4g",
        downlinkMbps: 120,
        hardwareConcurrency: 12,
      })
    ).toEqual({
      googleChunkSize: 64 * 1024 * 1024,
      onedriveChunkSize: 320 * 1024 * 160,
      maxParallelUploads: 6,
      sessionPrewarmLimit: 12,
      sessionBatchSize: 12,
    });
  });
});
