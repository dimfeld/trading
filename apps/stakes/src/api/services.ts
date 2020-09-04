import _ from 'lodash';
import * as fs from 'fs';
import pgPromise from 'pg-promise';
import { Api as TdaApi } from 'tda-api';

const pgUrl =
  process.env.PG_URL || 'postgres://postgres@localhost:5432/trading';

export const pgp = pgPromise();
export const db = pgp(pgUrl);

let authData = JSON.parse(
  fs.readFileSync(process.env.TDA_AUTH || 'tda_auth.json').toString()
);
export const tdaApi = new TdaApi(authData, true);
