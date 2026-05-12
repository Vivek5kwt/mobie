import { formatMoney } from "../src/utils/money";

describe("formatMoney", () => {
  it("formats Indian rupee prices with Indian comma grouping", () => {
    expect(formatMoney(122222, "INR")).toBe("\u20b91,22,222");
    expect(formatMoney(122222.5, "INR")).toBe("\u20b91,22,222.50");
    expect(formatMoney("\u20b9122222.00", "")).toBe("\u20b91,22,222");
    expect(formatMoney("Rs. 122222.00", "")).toBe("\u20b91,22,222");
  });
});
