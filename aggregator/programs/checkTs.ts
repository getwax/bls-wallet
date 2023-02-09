#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { checkTs } from "./helpers/typescript.ts";

await checkTs();
