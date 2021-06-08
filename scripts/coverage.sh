#!/bin/bash

set -euo pipefail

if which genhtml; then
  echo "genhtml found at $(which genhtml)"
else
  echo "genhtml not found, install via e.g. \`apt install lcov\`"
fi

rm -rf cov_profile

deno test \
  --allow-net \
  --allow-env \
  --allow-read \
  --coverage=cov_profile \
  --unstable \
  test/*.test.ts

deno coverage cov_profile --unstable --lcov >cov_profile/profile.lcov

genhtml -o cov_profile/html cov_profile/profile.lcov

echo
echo "---"
echo
echo "html coverage generated at cov_profile/html"
echo "Visualize with e.g. \`npx live-server cov_profile/html\`"
echo
