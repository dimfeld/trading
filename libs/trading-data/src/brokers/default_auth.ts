import * as findUp from 'find-up';
import { TdaAuthData } from '.';
import { AlpacaBrokerOptions } from './alpaca';
import * as debugMod from 'debug';

const debug = debugMod('default_auth');

export function defaultTdaAuth(): TdaAuthData {
  let file = findUp.sync('tda_auth.json');
  debug('Found TDA auth at %s', file);
  let data = require(file);
  return {
    client_id: data.client_id,
    refresh_token: data.refresh_token,
  };
}

export function defaultAlpacaAuth(paper = true): AlpacaBrokerOptions {
  let path = paper ? 'alpaca_auth_paper.json' : 'alpaca_auth.json';
  let file = findUp.sync(path);
  debug('Found Alpaca auth at %s', file);
  let data = require(file);
  return {
    key: data.key,
    secret: data.secret,
    paper,
  };
}
