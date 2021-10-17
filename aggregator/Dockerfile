FROM denoland/deno:1.14.1

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
