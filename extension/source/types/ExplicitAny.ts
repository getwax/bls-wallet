/**
 * Use this when you need to use `any` to do something meta that is beyond
 * TypeScript's ability to keep track of it. This often happens with generics.
 * Make sure you only use this type in a limited scope that exposes a well-typed
 * boundary. If you need to resort to `any` for some other reason, please just
 * use it normally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExplicitAny = any;

export default ExplicitAny;
