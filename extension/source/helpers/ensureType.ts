/** TODO: Docstring */
const ensureType =
  <T>() =>
  <V extends T>(value: V) =>
    value;

export default ensureType;
