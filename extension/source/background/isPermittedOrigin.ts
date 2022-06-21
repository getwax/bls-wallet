import assert from '../helpers/assert';

export default function isPermittedOrigin(
  messageOrigin: string,
  permittedOriginPattern: string,
) {
  if (permittedOriginPattern === '*') {
    return true;
  }

  if (permittedOriginPattern === '<quill>') {
    return messageOrigin === window.location.origin;
  }

  assert(
    !permittedOriginPattern.includes('*'),
    () =>
      new Error(
        `Origin patterns other than simply '*' are not yet implemented`,
      ),
  );

  return messageOrigin === permittedOriginPattern;
}
