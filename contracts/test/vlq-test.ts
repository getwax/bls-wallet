/* eslint-disable camelcase */
import { expect } from "chai";
import { ethers } from "hardhat";
import { VLQ, VLQ__factory } from "../typechain-types";

describe("vlq", function () {
  let vlq: VLQ;

  this.beforeAll(async () => {
    const [eoa] = await ethers.getSigners();
    const factory = new VLQ__factory(eoa);
    vlq = await factory.deploy();
  });

  it("0x00 -> 0", async () => {
    const { result, bytesRead } = await vlq.decode("0x00");
    expect(result).to.eq(0);
    expect(bytesRead).to.eq(1);
  });

  it("0x8203 -> 259", async () => {
    const { result, bytesRead } = await vlq.decode("0x8203");
    expect(result).to.eq(259); // = 2 * 128^1 + 3 * 128^0
    expect(bytesRead).to.eq(2);
  });

  it("0x828003 -> 32,771", async () => {
    const { result, bytesRead } = await vlq.decode("0x828003");
    expect(result).to.eq(32_771); // = 2 * 128^2 + 0 * 128^1 + 3 * 128^0
    expect(bytesRead).to.eq(3);
  });

  it("decodes a variety of values correctly", async () => {
    const inputsOutputs: [string, number][] = [
      ["0x01", 1],
      ["0x21", 33],
      ["0x812d", 173],
      ["0x830b", 395],
      ["0x9b77", 3575],
      ["0x828c38", 34360],
      ["0x8ba97d", 185597],
      ["0xa6b733", 629683],
      ["0x8289cd75", 4351733],
      ["0x8a8adc18", 21147160],
      ["0xc0e9c01c", 135946268],
      ["0x898b81f649", 2439019337],
      ["0x9fbdb29c75", 8450248309],
      ["0x81bdaeaa9c26", 50831461926],
      ["0x8881ccb59157", 275306596567],
      ["0xf38fe8c9ed29", 3955615757993],
      ["0x8899b5a9cca66f", 36057679860591],
      ["0xad83bdebf7d646", 198031773133638],
      ["0x82d8c794f3abd718", 1515373151841176],
    ];

    for (const [input, output] of inputsOutputs) {
      const { result, bytesRead } = await vlq.decode(input);
      expect(result).to.eq(output);
      expect(bytesRead).to.eq((input.length - 2) / 2);
    }
  });
});

// TODO: Make use of this elsewhere
// eslint-disable-next-line no-unused-vars
function encode(x: number) {
  const segments: number[] = [];

  while (x !== 0) {
    const segment = x % 128;
    segments.unshift(segment);
    x -= segment;
    x /= 128;
  }

  let result = "0x";

  for (let i = 0; i < segments.length; i++) {
    const keepGoing = i !== segments.length - 1;

    const byte = (keepGoing ? 128 : 0) + segments[i];
    result += byte.toString(16).padStart(2, "0");
  }

  return result;
}
