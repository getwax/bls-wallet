type AddTransactionFailure = (
  | { type: "invalid-signature"; description: string }
  | { type: "duplicate-nonce"; description: string }
);

export default AddTransactionFailure;
