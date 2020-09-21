import _ from 'lodash';
import * as fs from 'fs';
import { createBrokers, Brokers, pgp, db } from 'trading-data';

export { pgp, db };

export var brokers: Brokers;

export async function init() {
  brokers = await createBrokers();
}
