type TxId = number | undefined;

type AppEvent = (
  | { type: "listening"; data: { port: number } }
  | { type: "db-query"; data: { sql: string; params: unknown[] } }
  | { type: "waiting-unconfirmed-space" }
  | { type: "batch-attempt"; data: { txIds: TxId[]; attemptNumber: number } }
  | {
    type: "batch-attempt-failed";
    data: {
      txIds: TxId[];
      attemptNumber: number;
      error: Error;
    };
  }
  | { type: "batch-sent"; data: { txIds: TxId[] } }
  | { type: "batch-confirmed"; data: { txIds: TxId[]; blockNumber: number } }
  | { type: "warning"; data: string }
);

export default AppEvent;
