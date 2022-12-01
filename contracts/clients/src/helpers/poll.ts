export default async function poll(
  fn: Function,
  fnCondition: Function,
  retries: number,
  milliseconds: number,
) {
  let retryCount = 0;
  let result = await fn();

  while (fnCondition(result) && retryCount <= retries) {
    await wait(milliseconds);
    result = await fn();
    retryCount++;
  }
  return result;
}

function wait(milliseconds = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
