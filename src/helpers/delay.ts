export default async function delay(millis: number) {
  await new Promise((resolve) => setTimeout(resolve, millis));
}
