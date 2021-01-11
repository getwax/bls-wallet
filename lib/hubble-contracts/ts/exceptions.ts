export class HubbleError extends Error {}

export class EncodingError extends HubbleError {}

export class MismatchByteLength extends HubbleError {}

export class GenesisNotSpecified extends HubbleError {}

export class UserNotExist extends HubbleError {}

export class TreeException extends HubbleError {}

class AccountTreeException extends HubbleError {}

class StateTreeExceptions extends HubbleError {}

// TreeException

export class ExceedTreeSize extends TreeException {}

export class BadMergeAlignment extends TreeException {}

export class EmptyArray extends TreeException {}

export class MismatchLength extends TreeException {}

export class MismatchHash extends TreeException {}

export class NegativeIndex extends TreeException {}

// AccountTreeException
export class RegistrationFail extends AccountTreeException {}

export class WrongBatchSize extends AccountTreeException {}

// StateTreeExceptions

export class ExceedStateTreeSize extends StateTreeExceptions {}

export class SenderNotExist extends StateTreeExceptions {}

export class ReceiverNotExist extends StateTreeExceptions {}

export class StateAlreadyExist extends StateTreeExceptions {}

export class WrongTokenID extends StateTreeExceptions {}

export class InsufficientFund extends StateTreeExceptions {}

export class ZeroAmount extends StateTreeExceptions {}
