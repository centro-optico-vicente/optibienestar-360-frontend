#!/bin/bash

# show errors and exit on error
set -euo pipefail;


# nvm source dir
export NVM_DIR="$HOME/.nvm";
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh";
else
  echo "ERROR: nvm not found at $NVM_DIR/nvm.sh" >&2;
  exit 1;
fi


# nvm use 22 && pnpm clear && pnpm dev

nvm use 22;

pnpm clear;

pnpm dev;
