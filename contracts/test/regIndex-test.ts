/* eslint-disable camelcase */

import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { encodeRegIndex } from "../clients/src";
import { RegIndex, RegIndex__factory } from "../typechain-types";

describe("RegIndex", function () {
  let regIndex: RegIndex;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new RegIndex__factory(eoa);
    regIndex = await factory.deploy();
  });

  it("0x000000 -> 0", async () => {
    expect(encodeRegIndex(0)).to.eq("0x000000");

    const [value, stream] = await regIndex.decodePublic("0x000000");
    expect(value).to.eq(0);
    expect(stream).to.eq("0x");
  });

  it("0x000001 -> 1", async () => {
    expect(encodeRegIndex(1)).to.eq("0x000001");

    const [value, stream] = await regIndex.decodePublic("0x000001");
    expect(value).to.eq(1);
    expect(stream).to.eq("0x");
  });

  it("0x000100 -> 256", async () => {
    expect(encodeRegIndex(256)).to.eq("0x000100");

    const [value, stream] = await regIndex.decodePublic("0x000100");
    expect(value).to.eq(256);
    expect(stream).to.eq("0x");
  });

  // Last 3-byte index
  it("0x7fffff -> 8,388,607", async () => {
    expect(encodeRegIndex(8_388_607)).to.eq("0x7fffff");

    const [value, stream] = await regIndex.decodePublic("0x7fffff");
    expect(value).to.eq(8_388_607);
    expect(stream).to.eq("0x");
  });

  // First 4-byte index
  it("0x81000000 -> 8,388,608", async () => {
    expect(encodeRegIndex(8_388_608)).to.eq("0x81000000");

    const [value, stream] = await regIndex.decodePublic("0x81000000");
    expect(value).to.eq(8_388_608);
    expect(stream).to.eq("0x");
  });

  // Last 4-byte index
  it("0xff7fffff -> 1,073,741,823", async () => {
    expect(encodeRegIndex(1_073_741_823)).to.eq("0xff7fffff");

    const [value, stream] = await regIndex.decodePublic("0xff7fffff");
    expect(value).to.eq(1_073_741_823);
    expect(stream).to.eq("0x");
  });

  // First 5-byte index
  it("0x8180000000 -> 1,073,741,824", async () => {
    expect(encodeRegIndex(1_073_741_824)).to.eq("0x8180000000");

    const [value, stream] = await regIndex.decodePublic("0x8180000000");
    expect(value).to.eq(1_073_741_824);
    expect(stream).to.eq("0x");
  });

  // Last 5-byte index
  it("0xffff7fffff -> 137,438,953,471", async () => {
    expect(encodeRegIndex(137_438_953_471)).to.eq("0xffff7fffff");

    const [value, stream] = await regIndex.decodePublic("0xffff7fffff");
    expect(value).to.eq(137_438_953_471);
    expect(stream).to.eq("0x");
  });

  it("0x83ff(...31 ff bytes...)ff7fffff -> MaxUint256", async () => {
    const encoded =
      "0x83ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fffff";

    expect(encodeRegIndex(ethers.constants.MaxUint256)).to.eq(encoded);
    const [value, stream] = await regIndex.decodePublic(encoded);
    expect(value).to.eq(ethers.constants.MaxUint256);
    expect(stream).to.eq("0x");
  });

  it("Encodes and decodes random samples across magnitudes", async () => {
    const values = [
      "                      3",
      "                     26",
      "                    120",
      "                  1,357",
      "                  1,656",
      "                 74,775",
      "                355,530",
      "              4,639,402",
      "              7,643,718",
      "            336,168,140",
      "          2,248,431,734",
      "         14,108,050,677",
      "         93,972,126,798",
      "        758,745,242,416",
      "     11,006,691,901,310",
      "    107,460,085,614,397",
      "    409,358,331,676,454",
      "  1,811,951,865,105,052",
      " 18,302,669,715,470,464",
      "341,914,093,032,676,860",
    ].map((s) => BigNumber.from(s.trim().replace(/,/g, "")));

    for (const value of values) {
      const encoded = encodeRegIndex(value);
      const [decoded, stream] = await regIndex.decodePublic(encoded);
      expect(decoded).to.eq(value);
      expect(stream).to.eq("0x");
    }
  });
});
