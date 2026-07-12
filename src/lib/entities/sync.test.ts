import { describe, expect, it } from "vitest";
import { planUpserts, type SyncRow } from "./sync-types";
import { mapSoftoneTrdrRow, mapSoftoneItemRow, mapSoftoneCategoryRow } from "./sync-softone";
import { mapWooProduct, mapWooCustomer, mapWooCategory, mapWooAttributeTerm } from "./sync-woo";

const row = (externalId: string, code: string, name = `n-${code}`): SyncRow => ({ externalId, code, name });

describe("planUpserts", () => {
  it("matches existing rows by externalId first", () => {
    const existing = [{ id: "a", code: "OLD-CODE", extId: "10" }];
    const { toCreate, toUpdate } = planUpserts(existing, [row("10", "NEW-CODE", "New name")]);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toEqual([{ id: "a", row: row("10", "NEW-CODE", "New name") }]);
  });

  it("falls back to case-insensitive code match when externalId does not match", () => {
    const existing = [{ id: "b", code: "Abc-1", extId: null }];
    const { toCreate, toUpdate } = planUpserts(existing, [row("77", "ABC-1")]);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate.map((u) => u.id)).toEqual(["b"]);
  });

  it("creates rows that match neither externalId nor code", () => {
    const existing = [{ id: "c", code: "X", extId: "1" }];
    const { toCreate, toUpdate } = planUpserts(existing, [row("2", "Y")]);
    expect(toUpdate).toHaveLength(0);
    expect(toCreate).toEqual([row("2", "Y")]);
  });

  it("dedupes incoming rows by externalId, keeping the last one", () => {
    const { toCreate, toUpdate } = planUpserts([], [row("5", "first"), row("5", "last")]);
    expect(toUpdate).toHaveLength(0);
    expect(toCreate).toEqual([row("5", "last")]);
  });

  it("prefers externalId match over a different row's code match", () => {
    const existing = [
      { id: "byExt", code: "OTHER", extId: "9" },
      { id: "byCode", code: "SAME", extId: null },
    ];
    const { toCreate, toUpdate } = planUpserts(existing, [row("9", "SAME")]);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate.map((u) => u.id)).toEqual(["byExt"]);
  });
});

describe("mapSoftoneTrdrRow", () => {
  const columns = ["TRDR.TRDR", "TRDR.CODE", "TRDR.NAME", "TRDR.AFM", "TRDR.ADDRESS", "TRDR.CITY", "TRDR.ZIP", "TRDR.PHONE01", "TRDR.EMAIL"];
  it("maps a full row with extras", () => {
    const out = mapSoftoneTrdrRow(columns, ["123", "ΠΕΛ-001", "Ελληνικά Τρόφιμα ΑΕ", "094000000", "Οδός 1", "Αθήνα", "11111", "2101234567", "a@b.gr"]);
    expect(out).toEqual({
      externalId: "123",
      code: "ΠΕΛ-001",
      name: "Ελληνικά Τρόφιμα ΑΕ",
      extra: { afm: "094000000", address: "Οδός 1", city: "Αθήνα", zip: "11111", phone: "2101234567", email: "a@b.gr" },
    });
  });
  it("falls back to the key as code and skips empty extras", () => {
    const out = mapSoftoneTrdrRow(columns, [456, "", "Name", null, "", null, null, null, null]);
    expect(out).toEqual({ externalId: "456", code: "456", name: "Name", extra: {} });
  });
  it("maps ISACTIVE to isActive when the column is present", () => {
    const cols = [...columns, "TRDR.ISACTIVE"];
    const base = ["1", "C", "N", null, null, null, null, null, null];
    expect(mapSoftoneTrdrRow(cols, [...base, "1"]).isActive).toBe(true);
    expect(mapSoftoneTrdrRow(cols, [...base, 0]).isActive).toBe(false);
    expect(mapSoftoneTrdrRow(columns, base).isActive).toBeUndefined();
  });
});

describe("mapSoftoneItemRow", () => {
  const columns = ["ITEM.MTRL", "ITEM.CODE", "ITEM.NAME", "ITEM.PRICEW", "ITEM.PRICER"];
  it("maps prices to numeric extras", () => {
    const out = mapSoftoneItemRow(columns, ["7", "PR-1", "Εκτυπωτής", "10,5", 15]);
    expect(out).toEqual({
      externalId: "7",
      code: "PR-1",
      name: "Εκτυπωτής",
      extra: { priceWholesale: 10.5, priceRetail: 15 },
    });
  });
  it("omits missing prices", () => {
    const out = mapSoftoneItemRow(columns, ["8", "PR-2", "Οθόνη", null, ""]);
    expect(out.extra).toEqual({});
  });
  it("maps ISACTIVE and prefers the main-table column over other tables", () => {
    const cols = ["MTRUNIT.CODE", "ITEM.MTRL", "MTRL.CODE", "ITEM.NAME", "MTRL.ISACTIVE"];
    const out = mapSoftoneItemRow(cols, ["ΤΕΜ", "9", "PR-9", "Server", "0"]);
    expect(out.code).toBe("PR-9"); // MTRL.CODE κερδίζει το MTRUNIT.CODE
    expect(out.isActive).toBe(false);
    expect(mapSoftoneItemRow(cols, ["ΤΕΜ", "9", "PR-9", "Server", "1"]).isActive).toBe(true);
    expect(mapSoftoneItemRow(columns, ["9", "PR-9", "Server", null, null]).isActive).toBeUndefined();
  });
});

describe("mapSoftoneCategoryRow", () => {
  it("maps key/code/name and falls back code→key", () => {
    const columns = ["ITECATEGORY.MTRCATEGORY", "ITECATEGORY.CODE", "ITECATEGORY.NAME"];
    expect(mapSoftoneCategoryRow(columns, ["3", "CAT3", "Γραφείο"])).toEqual({ externalId: "3", code: "CAT3", name: "Γραφείο" });
    expect(mapSoftoneCategoryRow(columns, ["4", null, "Λοιπά"])).toEqual({ externalId: "4", code: "4", name: "Λοιπά" });
  });
});

describe("mapWooProduct", () => {
  it("uses sku as code when present", () => {
    expect(mapWooProduct({ id: 11, sku: "SKU-1", name: "Καρέκλα", price: "40", regular_price: "50" })).toEqual({
      externalId: "11",
      code: "SKU-1",
      name: "Καρέκλα",
      extra: { priceRetail: 50 },
    });
  });
  it("falls back to id when sku is empty", () => {
    const out = mapWooProduct({ id: 12, sku: "", name: "Τραπέζι" });
    expect(out.code).toBe("12");
    expect(out.extra).toEqual({});
  });
});

describe("mapWooCustomer", () => {
  it("builds name from first+last", () => {
    expect(mapWooCustomer({ id: 5, first_name: "Γιάννης", last_name: "Κ.", email: "g@x.gr" })).toEqual({
      externalId: "5",
      code: "5",
      name: "Γιάννης Κ.",
      extra: { email: "g@x.gr" },
    });
  });
  it("falls back to email when names are empty", () => {
    expect(mapWooCustomer({ id: 6, first_name: "", last_name: "", email: "only@x.gr" }).name).toBe("only@x.gr");
  });
});

describe("mapWooCategory", () => {
  it("uses slug as code", () => {
    expect(mapWooCategory({ id: 9, slug: "epipla", name: "Έπιπλα" })).toEqual({ externalId: "9", code: "epipla", name: "Έπιπλα" });
  });
});

describe("mapWooAttributeTerm", () => {
  it("uses slug as code and name as name", () => {
    expect(mapWooAttributeTerm({ id: 21, slug: "kokkino", name: "Κόκκινο" })).toEqual({ externalId: "21", code: "kokkino", name: "Κόκκινο" });
  });
});
