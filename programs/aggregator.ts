#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import app from "../src/app/app.ts";

await app();
