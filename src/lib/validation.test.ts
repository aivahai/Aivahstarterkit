import { describe, expect, it } from "vitest";
import { validateAgentFiles, validateUpload } from "@/lib/validation";

describe("upload validation", () => {
  it("accepts supported visual and presentation media", () => {
    expect(
      validateUpload(
        new File(["x"], "avatar.webp", { type: "image/webp" }),
        "character",
      ),
    ).toBeNull();
    expect(
      validateAgentFiles(
        [new File(["x"], "deck.pdf", { type: "application/pdf" })],
        true,
      ),
    ).toBeNull();
  });

  it("rejects non-presentation documents for presentation agents", () => {
    expect(
      validateAgentFiles(
        [new File(["x"], "notes.txt", { type: "text/plain" })],
        true,
      ),
    ).toMatch(/PDF/);
  });
});
