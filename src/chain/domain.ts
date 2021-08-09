import { ethers } from "../../deps/index.ts";

export default ethers.utils.arrayify(
  ethers.utils.keccak256("0xfeedbee5"),
);
