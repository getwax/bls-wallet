FROM denoland/deno:1.13.0

ADD build /app
WORKDIR /app

CMD [ \
  "deno", \
  "run", \
  "--unstable", \
  "-A", \
  "aggregator.js" \
]
