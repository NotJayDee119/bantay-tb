import { describe, expect, it } from "vitest";
import {
  addressQueries,
  cleanBarangayName,
  cleanStreetAddress,
  kmBetween,
  maxKmFor,
  nearestHit,
  placeWords,
} from "../lib/geocode";

describe("cleanBarangayName", () => {
  it("drops the parenthetical OSM does not use", () => {
    expect(cleanBarangayName("Barangay 24-C (Pob.)")).toBe("Barangay 24-C");
    expect(cleanBarangayName("Fatima (Benowang)")).toBe("Fatima");
    expect(cleanBarangayName("Bajada")).toBe("Bajada");
  });
});

describe("cleanStreetAddress", () => {
  it("strips house numbers and purok numbers", () => {
    expect(cleanStreetAddress("123 Mabini St., Purok 5")).toBe("Mabini St.");
  });

  it("strips block, lot and phase", () => {
    expect(
      cleanStreetAddress("Blk 5 Lot 2 Phase 1 Ecoland Subdivision")
    ).toBe("Ecoland Subdivision");
  });

  it("strips #-numbers and lettered house numbers", () => {
    expect(cleanStreetAddress("#45 Rizal St.")).toBe("Rizal St.");
    expect(cleanStreetAddress("12-B Quirino Ave")).toBe("Quirino Ave");
  });

  it("keeps named puroks and landmarks", () => {
    expect(cleanStreetAddress("Purok Malinawon, near Talomo Church")).toBe(
      "Purok Malinawon, near Talomo Church"
    );
  });
});

describe("addressQueries", () => {
  it("goes from strict to loose without duplicates", () => {
    expect(addressQueries("123 Mabini St., Purok 5", "Barangay 24-C (Pob.)")).toEqual([
      "123 Mabini St., Purok 5, Barangay 24-C, Davao City, Philippines",
      "Mabini St., Barangay 24-C, Davao City, Philippines",
      "Mabini St., Davao City, Philippines",
    ]);
  });

  it("tries the place name without Subdivision / Village", () => {
    expect(
      addressQueries("Blk 5 Lot 2 Ecoland Subdivision", "Matina Crossing 74-A")
    ).toContain("Ecoland, Davao City, Philippines");
  });

  it("tries each part of the address on its own", () => {
    const qs = addressQueries("Ecoland Subdivision, Quimpo Blvd", "Matina Crossing 74-A");
    expect(qs).toContain("Ecoland Subdivision, Davao City, Philippines");
    expect(qs.length).toBeLessThanOrEqual(4);
  });
});

describe("placeWords", () => {
  it("keeps the names and drops numbers and street types", () => {
    expect(placeWords("123 Mabini St., Purok 5")).toEqual(["mabini"]);
    expect(placeWords("Blk 5 Lot 2 Ecoland Subdivision")).toEqual(["ecoland"]);
  });

  it("finds nothing to search for in a bare purok number", () => {
    expect(placeWords("Purok 3")).toEqual([]);
  });
});

describe("maxKmFor", () => {
  it("gives small Poblacion barangays the floor", () => {
    expect(maxKmFor({ area_km2: 0.1 })).toBe(2);
  });

  it("scales with the barangay's size", () => {
    expect(maxKmFor({ area_km2: 6.72 })).toBeCloseTo(2.92, 1); // Talomo
    expect(maxKmFor({ area_km2: 100 })).toBeGreaterThan(10);
  });

  it("falls back when the area is unknown", () => {
    expect(maxKmFor({})).toBe(5);
  });
});

describe("nearestHit", () => {
  const bgy = { lat: 7.0731, lon: 125.6128 }; // Poblacion area

  it("keeps the match closest to the barangay", () => {
    const far = { lat: 7.0731, lon: 125.66, label: "far" }; // ~5.2 km east
    const near = { lat: 7.075, lon: 125.615, label: "near" };
    expect(nearestHit([far, near], bgy)?.label).toBe("near");
  });

  it("rejects matches in another part of the city", () => {
    const calinan = { lat: 7.19, lon: 125.45, label: "Calinan" };
    expect(kmBetween(calinan, bgy)).toBeGreaterThan(5);
    expect(nearestHit([calinan], bgy)).toBeNull();
  });
});
