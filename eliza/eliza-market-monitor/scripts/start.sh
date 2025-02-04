#!/bin/bash
pnpm install
node --loader ts-node/esm src/index.ts --characters="characters/market_bot.character.json"
