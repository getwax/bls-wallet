import { ethers } from "../../deps.ts";

export default ethers.utils.arrayify(
  ethers.utils.keccak256("0xfeedbee5"),
);
