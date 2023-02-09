FROM denoland/deno:1.30.1

ADD build /app
WORKDIR /app

RUN deno cache ts/programs/aggregator.ts

ENV IS_DOCKER="true"

CMD [ \
  "deno", \
  "run", \
  "-A", \
  "ts/programs/aggregator.ts" \
]
