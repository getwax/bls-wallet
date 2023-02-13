#!/bin/bash

file_path="./networks/local.json"
max_tries=30
tries=0

while [ $tries -lt $max_tries ]; do
  if [ -f "$file_path" ]; then
    break
  fi

  sleep 1
  tries=$((tries + 1))
done

if [ $tries -eq $max_tries ]; then
  echo "Error: Reached max_tries waiting for $file_path to be generated"
  exit 1
fi
