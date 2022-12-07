import { expect } from "chai";
import poll from "../src/helpers/poll";

describe("poll", () => {
  it("should return result when function condition has been met", async () => {
    // Arrange
    let counter = 0;
    const fn = () => {
      const addCount = () => counter++;
      addCount();
      return counter;
    };
    const fnCondition = (result: number) => result < 5;

    // Act
    const result = await poll(fn, fnCondition, 5, 100);

    // Assert
    expect(result).to.equal(5);
  });

  it("should poll until the number of retries has been met", async () => {
    // Arrange
    let counter = 0;
    const fn = () => {
      const addCount = () => counter++;
      addCount();
      return counter;
    };
    const fnCondition = (result: number) => result < 3;

    // Act
    const result = await poll(fn, fnCondition, 1, 100);

    // Assert
    // fn() is called twice before first retry, hence the result should equal 3
    expect(result).to.equal(3);
  });
});
