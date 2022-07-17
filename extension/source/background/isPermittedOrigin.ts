import assert from '../helpers/assert';

export default function isPermittedOrigin(
  requestOrigin: string,
  permittedOriginPattern: string,
) {
  if (permittedOriginPattern === '*') {
    return true;
  }

  if (permittedOriginPattern === '<quill>') {
    return requestOrigin === window.location.origin;
  }

  assert(
    !permittedOriginPattern.includes('*'),
    () =>
      new Error(
        "Origin patterns other than simply '*' are not yet implemented",
      ),
  );

  return requestOrigin === permittedOriginPattern;
}
