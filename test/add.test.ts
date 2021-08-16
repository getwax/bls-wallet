import { expect } from "chai";

import add from "../src/add";

describe("add", () => {
  it("adds numbers", () => {
    expect(add(3, 5)).to.equal(8);
  });
});
