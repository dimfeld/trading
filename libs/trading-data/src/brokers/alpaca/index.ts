import * as Alpaca from '@alpacahq/alpaca-trade-api';

const token = require('../../../../../alpaca_auth_paper.json');

export const alpaca = new Alpaca({
  keyId: token.key,
  secretKey: token.secret,
  paper: true,
  usePolygon: true,
});
