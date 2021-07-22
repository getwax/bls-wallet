type AddTransactionFailure = (
  | { type: "invalid-format"; description: string }
  | { type: "invalid-signature"; description: string }
  | { type: "duplicate-nonce"; description: string }
  | { type: "insufficient-reward"; description: string }
  | { type: "unpredictable-gas-limit"; description: string }
);

export default AddTransactionFailure;
