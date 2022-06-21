#!/usr/bin/env -S deno run --unstable --allow-run --allow-read --allow-write --allow-env

// TODO (merge-ok) Consider turning this into a standard eslint rule

import { lintTodosFixmes } from "./helpers/lint.ts"; // merge-ok

await lintTodosFixmes(); // merge-ok
