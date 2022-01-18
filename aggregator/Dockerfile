FROM denoland/deno:1.16.3

ADD build /app
WORKDIR /app

RUN deno cache --unstable ts/programs/aggregator.ts

CMD [ \
  "deno", \
  "run", \
  "--unstable", \
  "-A", \
  "ts/programs/aggregator.ts" \
]
