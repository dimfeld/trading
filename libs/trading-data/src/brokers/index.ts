import * as tda from './tda';
import * as alpaca from './alpaca';

export interface BrokerOptions {
  tda?: {
    auth: tda.AuthData;
    autorefresh?: boolean;
  };
  alpaca?: alpaca.AlpacaBrokerOptions;
}

/** A class that arbitrates requests through multiple brokers */
export default class Brokers {
  tda?: tda.Api;
  alpaca?: alpaca.Api;

  constructor(options: BrokerOptions) {
    if (options.tda) {
      this.tda = new tda.Api(options.tda.auth, options.tda.autorefresh ?? true);
    }

    if (options.alpaca) {
      this.alpaca = new alpaca.Api(options.alpaca);
    }
  }

  init() {
    return Promise.all([this.alpaca?.init(), this.tda?.init()]);
  }
}
