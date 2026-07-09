import { describe, it, expect } from "vitest";
import { getInitials, getAvatarColor } from "./avatar";

describe("getInitials", () => {
  it("takes first letter of first and last name, uppercased", () => {
    expect(getInitials("Γιώργος", "Παπαδόπουλος")).toBe("ΓΠ");
  });
  it("falls back to first two letters if last name missing", () => {
    expect(getInitials("Άννα", "")).toBe("Α");
  });
  it("returns '?' for empty input", () => {
    expect(getInitials("", "")).toBe("?");
  });
});

describe("getAvatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(getAvatarColor("user-1")).toBe(getAvatarColor("user-1"));
  });
  it("returns an hsl string", () => {
    expect(getAvatarColor("user-1")).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
  it("varies across seeds", () => {
    expect(getAvatarColor("user-1")).not.toBe(getAvatarColor("user-99"));
  });
});
