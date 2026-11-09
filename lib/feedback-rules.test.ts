import { describe, expect, it } from "vitest";
import { MAX_MESSAGE, validFeedback } from "./feedback-rules";

describe("feedback", () => {
  it("accepts a message with an optional email and page", () => {
    expect(validFeedback({ message: "  MATH 2A shows the wrong prereq  ", email: "a@uci.edu", page: "/plan/BS-19H" }))
      .toEqual({ message: "MATH 2A shows the wrong prereq", email: "a@uci.edu", page: "/plan/BS-19H" });
    expect(validFeedback({ message: "Love it" })).toEqual({ message: "Love it", email: null, page: null });
  });

  it("rejects empty, oversized, badly addressed, and bot-filled messages", () => {
    expect(validFeedback({ message: " " })).toBeNull();
    expect(validFeedback({ message: "x".repeat(MAX_MESSAGE + 1) })).toBeNull();
    expect(validFeedback({ message: "Hello there", email: "not an email" })).toBeNull();
    expect(validFeedback({ message: "Hello there", website: "spam.example" })).toBeNull();
    expect(validFeedback(null)).toBeNull();
  });

  it("only keeps a page path on this site", () => {
    expect(validFeedback({ message: "Hello there", page: "https://evil.example" })?.page).toBeNull();
  });
});
