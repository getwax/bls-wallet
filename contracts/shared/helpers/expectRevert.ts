import { expect } from "chai";

export default async function expectRevert(
  throwingPromise: Promise<any>,
  expectedErrorMsg?: string,
) {
  let failedToThrow = false;
  try {
    await throwingPromise;
    failedToThrow = true;
  } catch (e) {
    if (expectedErrorMsg != undefined) {
      const errMsg = (e as Error).message;
      expect(errMsg).to.contain(expectedErrorMsg);
    }
  } finally {
    if (failedToThrow) {
      let failMsg = `No error received`;
      if (expectedErrorMsg != undefined) {
        failMsg += `, expected: ${expectedErrorMsg}`;
      }
      expect.fail(failMsg);
    }
  }
}
