import * as pgp_mod from 'pg-promise';
import * as config from './config';

export var pgp = pgp_mod();
export var db = pgp(config.postgres.url);

export const localTimeZone = process.env.LOCAL_TIME_ZONE || 'Pacific/Honolulu';
