const blsAddresses = {
  arb1: [],
  rinkarby: [
    "0x3f509901664E21e2dc3a189C9E67DDC2864848cC",
    "0x4AA467DA53E722E0C9aa516083aC5A0b40e5a0c8",
    "0xAA0E6088e0B8801c9D679A1C715EF836129458Cc",
  ],
  optimistic: [
    "0x69A9c53e7000c8B7aF3f70212ba7a8E30fB30Cb4",
    "0xAeaDee30db4e75c64BC8ABE54f818b8fc9097f1b",
    "0x4FCa9CA9938Ee6b4E3200a295b1152c72d6df0b7",
  ],
  optimisticKovan: [
    "0xEc76AE8adEFc6462986A673Feff40b2Cdd56B3BC",
    "0x808AeC84A987368B915a7Fd048cd1B20859FcbC9",
    "0x00478B7Ea27581f901D84a7ea2989f68416d3568",
  ],
};

export default function getBLSAddresses(networkName: string): string[] {
  const addresses = blsAddresses[networkName];
  if (!addresses) {
    throw new Error(`No configuration for: "${networkName}"`);
  }
  return addresses;
}
