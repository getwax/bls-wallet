import { HTTPMethods } from "../../deps.ts";

type AppEvent =
  | { type: "listening"; data: { port: number } }
  | { type: "db-query"; data: { sql: string; params: unknown[] } }
  | { type: "waiting-unconfirmed-space" }
  | { type: "aggregate-bundle-unprofitable" }
  | {
    type: "submission-attempt";
    data: { publicKeyShorts: string[]; attemptNumber: number };
  }
  | {
    type: "submission-attempt-failed";
    data: {
      publicKeyShorts: string[];
      attemptNumber: number;
      error: Error;
    };
  }
  | { type: "submission-sent"; data: { hash: string } }
  | {
    type: "submission-confirmed";
    data: { hash: string; bundleHashes: string[]; blockNumber: number };
  }
  | { type: "warning"; data: string }
  | {
    type: "bundle-added";
    data: {
      hash: string;
      publicKeyShorts: string[];
    };
  }
  | {
    type: "error";
    data: string;
  }
  | {
    type: "request-start";
    data: {
      method: HTTPMethods;
      path: string;
    };
  }
  | {
    type: "request-end";
    data: {
      method: HTTPMethods;
      path: string;
      status: number;
      duration: number;
    };
  };

export default AppEvent;
