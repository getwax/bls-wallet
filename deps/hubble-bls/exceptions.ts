export class HubbleBlsError extends Error {}

export class HashToFieldError extends HubbleBlsError {}

export class MclError extends HubbleBlsError {}

export class SignerError extends HubbleBlsError {}

// HashToFieldError

export class BadDomain extends HashToFieldError {}

// MclError

export class EmptyArray extends MclError {}

export class MismatchLength extends MclError {}

export class BadMessage extends MclError {}

export class BadHex extends MclError {}

export class BadByteLength extends MclError {}

// SignerError

export class NullSigner extends SignerError {}
