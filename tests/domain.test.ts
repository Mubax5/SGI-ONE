import { describe, expect, it } from "vitest";
import {
  can,
  invoiceBalance,
  moneyFromInput,
  totals,
  validateTransition,
  paymentStatus,
  type Actor,
} from "@/lib/domain";
describe("Money and domain rules", () => {
  it("stores rupiah and decimals as exact integer minor units", () => {
    expect(moneyFromInput("2500000")).toBe(250000000);
    expect(moneyFromInput("125.50")).toBe(12550);
    expect(totals([101, 202], 1100)).toEqual({
      subtotal: 303,
      tax: 33,
      total: 336,
    });
  });
  it.each(["0", "-1", "1e6", "NaN", "1.001", "1,000", "90000000001"])(
    "rejects invalid amount %s",
    (value) => {
      expect(() => moneyFromInput(value)).toThrow();
    },
  );
  it("calculates the PRD partial-payment example", () => {
    expect(invoiceBalance(550000000, 200000000, 0)).toBe(350000000);
  });
  it("enforces job progression and assignment", () => {
    expect(() => validateTransition("draft", "completed", 0)).toThrow();
    expect(() => validateTransition("draft", "assigned", 0)).toThrow();
    expect(() =>
      validateTransition("assigned", "in_progress", 1),
    ).not.toThrow();
    expect(() => validateTransition("completed", "in_progress", 1)).toThrow();
  });
  it("does not project drafts as revenue and derives invoice status", () => {
    expect(paymentStatus("draft", 0, 0, null)).toBe("draft");
    expect(paymentStatus("issued", 350, 200, "2999-01-01")).toBe(
      "partially_paid",
    );
    expect(paymentStatus("issued", 350, 200, "2000-01-01")).toBe("overdue");
    expect(paymentStatus("issued", 0, 550, "2000-01-01")).toBe("paid");
  });
  it("denies finance role administration and allows many roles", () => {
    const actor: Actor = {
      id: "test",
      name: "Test",
      email: "test@example.com",
      roles: ["finance"],
    };
    expect(can(actor, "users")).toBe(false);
    const ops = { ...actor, roles: ["operations"] as Actor["roles"] };
    expect(can(ops, "invoicesRead")).toBe(false);
    expect(can(ops, "paymentsRead")).toBe(false);
    expect(can(ops, "dashboard")).toBe(true);
    expect(can({ ...actor, roles: ["finance", "admin"] }, "users")).toBe(true);
  });
});
