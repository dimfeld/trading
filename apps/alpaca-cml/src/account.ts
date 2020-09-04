#!/usr/bin/env ts-node
import { alpaca } from './services';

async function run() {
  let account = await alpaca.getAccount();
  console.dir(account);
}

run().catch(console.error);
