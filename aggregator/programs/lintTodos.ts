#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

// TODO (merge-ok) Consider turning this into a standard eslint rule

import { lintTodosFixmes } from "./helpers/lint.ts"; // merge-ok

await lintTodosFixmes(); // merge-ok
