import * as findUp from 'find-up';
import { TdaAuthData } from '.';
import { AlpacaBrokerOptions } from './alpaca';

export function defaultTdaAuth(): TdaAuthData {
  let file = findUp.sync('tda_auth.json');
  let data = require(file);
  return {
    client_id: data.client_id,
    refresh_token: data.refresh_token,
  };
}

export function defaultAlpacaAuth(paper = true): AlpacaBrokerOptions {
  let path = paper ? 'alpaca_auth_paper.json' : 'alpaca_auth.json';
  let file = findUp.sync(path);
  let data = require(file);
  return {
    key: data.key,
    secret: data.secret,
    paper,
  };
}
