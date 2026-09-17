import { describe, expect, it } from "vitest";
import { asArray, unwrapResults } from "@/lib/api";

describe("API response normalization", () => {
  it("unwraps the platform response envelope", () => {
    expect(unwrapResults({ results: { id: 7 }, statusCode: 200 })).toEqual({
      id: 7,
    });
  });

  it("normalizes resource collections", () => {
    expect(asArray({ avatars: [{ id: 1 }] }, ["avatars"])).toEqual([{ id: 1 }]);
    expect(asArray([{ id: 2 }])).toEqual([{ id: 2 }]);
  });
});
