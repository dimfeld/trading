#!/bin/bash
set -e
./get_filled_orders.ts > ./tos-trades.json
rushx start --tos ./tos-trades.json
