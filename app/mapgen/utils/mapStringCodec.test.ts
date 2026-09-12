import { afterEach, describe, expect, it, vi } from "vitest";
import type { Map } from "~/types";
import { generateHexRings } from "~/utils/hexCoordinates";
import { decodeMapString, encodeMapString } from "./mapStringCodec";
import {
  decodeAsyncMapString,
  decodeTtpgMapString,
  encodeAsyncMapString,
  encodeTtpgMapString,
} from "./externalMapStringCodec";

function mapFixture(rings: number): Map {
  const map: Map = generateHexRings(rings).map((position, idx) => ({
    idx,
    position,
    type: "OPEN",
  }));
  map[0] = { ...map[0], type: "SYSTEM", systemId: "18" };
  map[1] = { ...map[1], type: "SYSTEM", systemId: "19" };
  map[2] = { ...map[2], type: "SYSTEM", systemId: "83A", rotation: 120 };
  map[3] = { ...map[3], type: "HOME", seat: 0 };
  map[4] = { ...map[4], type: "CLOSED" };
  map[5] = { ...map[5], type: "HOME", seat: 1 };
  return map;
}
afterEach(() => vi.restoreAllMocks());

describe("map sharing and import/export", () => {
  it.each([2, 3, 4, 5])(
    "round trips a %i-ring editor map including seats, closed cells and hyperlane rotation",
    (rings) => {
      const map = mapFixture(rings);
      const encoded = encodeMapString(map);
      expect(encoded.split(",").slice(0, 6)).toEqual([
        "19",
        "83A:120",
        "H0",
        "X",
        "H1",
        "_",
      ]);
      const decoded = decodeMapString(encoded)!;
      expect(decoded.ringCount).toBe(rings);
      expect(decoded.map).toEqual(map);
      expect(decoded.closedTiles).toEqual([4]);
      expect(decoded.gameSets).toEqual(["base", "pok"]);
    },
  );
  it.each([
    {
      name: "TTPG",
      encode: encodeTtpgMapString,
      decode: decodeTtpgMapString,
      hyperlane: "83A2",
    },
    {
      name: "Async",
      encode: encodeAsyncMapString,
      decode: decodeAsyncMapString,
      hyperlane: "83A120",
    },
  ])(
    "exports and reimports $name while preserving systems and seats",
    ({ encode, decode, hyperlane }) => {
      const map = mapFixture(3);
      const encoded = encode(map);
      expect(encoded.split(" ").slice(0, 6)).toEqual([
        "19",
        hyperlane,
        "0",
        "-1",
        "0",
        "-1",
      ]);
      const decoded = decode(encoded)!;
      expect(decoded.ringCount).toBe(3);
      expect(decoded.map[2]).toMatchObject({
        type: "SYSTEM",
        systemId: "83A",
        rotation: 120,
      });
      expect(decoded.map[3]).toMatchObject({ type: "HOME", seat: 0 });
      expect(decoded.map[5]).toMatchObject({ type: "HOME", seat: 1 });
      expect(decoded.map[4].type).toBe("OPEN");
      expect(encode(decoded.map)).toBe(encoded);
      expect(decode(encoded.replaceAll(" ", ", "))).toEqual(decoded);
      const factionMap = encode(map, {
        homeSystemId: (tile) => (tile.seat === 0 ? "1" : "2"),
      });
      expect(factionMap.split(" ")[2]).toBe("1");
      expect(factionMap.split(" ")[4]).toBe("2");
    },
  );
  it.each([0, 60, 120, 180, 240, 300])(
    "converts rotation %i between TTPG steps and Async degrees",
    (rotation) => {
      const map = mapFixture(3);
      map[2] = { ...map[2], type: "SYSTEM", systemId: "83B", rotation };
      const ttpg = encodeTtpgMapString(map);
      const async = encodeAsyncMapString(map);
      expect(ttpg.split(" ")[1]).toBe(`83B${rotation / 60}`);
      expect(async.split(" ")[1]).toBe(`83B${rotation || ""}`);
      expect(encodeAsyncMapString(decodeTtpgMapString(ttpg)!.map)).toBe(async);
      expect(encodeTtpgMapString(decodeAsyncMapString(async)!.map)).toBe(ttpg);
    },
  );
  it("supports bare side-A hyperlane numbers in TTPG", () => {
    const encoded = ["83", ...Array(17).fill("-1")].join(" ");
    expect(decodeTtpgMapString(encoded)?.map[1]).toMatchObject({
      type: "SYSTEM",
      systemId: "83A",
    });
    expect(encodeTtpgMapString(decodeTtpgMapString(encoded)!.map)).toBe(
      encoded,
    );
  });
  it.each(["", " ", "19 20", `bogus ${Array(17).fill("-1").join(" ")}`])(
    "rejects invalid external strings: %s",
    (value) => {
      expect(decodeAsyncMapString(value)).toBeNull();
      expect(decodeTtpgMapString(value)).toBeNull();
    },
  );
  it("keeps editing possible when an internal shared map contains obsolete system IDs", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const encoded = ["missing-system", "H-1", ...Array(16).fill("_")].join(",");
    const decoded = decodeMapString(encoded)!;
    expect(decoded.map).toHaveLength(19);
    expect(decoded.map[1].type).toBe("OPEN");
    expect(decoded.map[2].type).toBe("OPEN");
    expect(decoded.map[0]).toMatchObject({ type: "SYSTEM", systemId: "18" });
  });
});
