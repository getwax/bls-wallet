#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import app from "../src/app/app.ts";
import AppEvent from "../src/app/AppEvent.ts";

await app((evt: AppEvent) => {
  if ("data" in evt) {
    console.log(evt.type, evt.data);
  } else {
    console.log(evt.type);
  }
});
