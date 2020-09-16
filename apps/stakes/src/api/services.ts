import _ from 'lodash';
import * as fs from 'fs';
import pgPromise from 'pg-promise';
import { createBrokers, Brokers } from 'trading-data';

const pgUrl =
  process.env.PG_URL || 'postgres://postgres@localhost:5432/trading';

export const pgp = pgPromise();
export const db = pgp(pgUrl);

let authData = JSON.parse(
  fs.readFileSync(process.env.TDA_AUTH || 'tda_auth.json').toString()
);

export var brokers: Brokers;

export async function init() {
  brokers = await createBrokers();
}
