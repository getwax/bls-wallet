FROM denoland/deno:1.23.4

ADD build /app
WORKDIR /app

RUN deno cache --unstable ts/programs/aggregator.ts

ENV NETWORK_CONFIG_PATH_OVERRIDE="/app/networkConfig.json"

CMD [ \
  "deno", \
  "run", \
  "--unstable", \
  "-A", \
  "ts/programs/aggregator.ts" \
]
