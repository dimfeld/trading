"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = exports.tdaToOccSymbol = exports.occToTdaSymbol = exports.optionInfoFromSymbol = void 0;
const _ = require("lodash");
const got = require("got");
const querystring = require("querystring");
const debugMod = require("debug");
__exportStar(require("./quote"), exports);
__exportStar(require("./option_chain"), exports);
const debug = debugMod('tda_api');
const HOST = 'https://api.tdameritrade.com';
const indexes = ['SPX', 'RUT', 'NDX'];
const symbolToTda = {};
const tdaToSymbol = {};
for (let sym of indexes) {
    let tda = `$${sym}.X`;
    symbolToTda[sym] = tda;
    tdaToSymbol[tda] = sym;
}
function optionInfoFromSymbol(symbol) {
    let underlying = symbol.slice(0, 6).trim();
    if (symbol.length <= 6) {
        return {
            underlying,
            expiration: undefined,
            call: undefined,
            strike: undefined,
        };
    }
    return {
        underlying,
        expiration: symbol.slice(6, 12),
        call: symbol[12] === 'C',
        strike: +_.trimStart(symbol.slice(13)) / 1000,
    };
}
exports.optionInfoFromSymbol = optionInfoFromSymbol;
function occToTdaSymbol(occ) {
    if (occ.length !== 21 || occ.indexOf('_') >= 0) {
        // Not an OCC-format option symbol. Just do the simple transformation.
        return symbolToTda[occ] || occ;
    }
    // Change from OCC format to the format that TDA expects.
    let info = optionInfoFromSymbol(occ);
    let side = info.call ? 'C' : 'P';
    // OCC expiration is YYMMDD. TDA is MMDDYY
    let expiration = `${info.expiration.slice(2, 4)}${info.expiration.slice(4, 6)}${info.expiration.slice(0, 2)}`;
    let dollars = _.trimStart(occ.slice(13, 18), ' 0');
    let cents_raw = _.trimEnd(occ.slice(18), ' 0');
    let cents = cents_raw ? `.${cents_raw}` : '';
    return `${info.underlying}_${expiration}${side}${dollars}${cents}`;
}
exports.occToTdaSymbol = occToTdaSymbol;
function tdaToOccSymbol(tda) {
    let occ = tdaToSymbol[tda];
    if (occ) {
        return occ;
    }
    let m = /^([a-zA-Z]+)(?:_(\d\d)(\d\d)(\d\d)([C|P])(\d*)(?:\.(\d+))?)?$/.exec(tda);
    if (!m) {
        throw new Error(`Failed to parse TDA symbol '${tda}'`);
    }
    let underlying = m[1];
    if (!m[2]) {
        // It's an equity symbol so just return it as-is;
        return underlying;
    }
    underlying = _.padEnd(m[1], 6, ' ');
    let month = m[2];
    let day = m[3];
    let year = m[4];
    let side = m[5];
    let dollars = _.padStart(m[6], 5, '0');
    let cents = _.padEnd(m[7] || '000', 3, '0');
    return `${underlying}${year}${month}${day}${side}${dollars}${cents}`;
}
exports.tdaToOccSymbol = tdaToOccSymbol;
class Api {
    constructor(auth, autorefresh = true) {
        this.auth = auth;
        this.autorefresh = autorefresh;
    }
    async refresh() {
        // Refresh the access token.
        try {
            let body = await got(`${HOST}/v1/oauth2/token`, {
                method: 'POST',
                form: true,
                body: {
                    grant_type: 'refresh_token',
                    refresh_token: this.auth.refresh_token,
                    client_id: this.auth.client_id,
                },
            });
            let result = JSON.parse(body.body);
            this.access_token = result.access_token;
            if (this.autorefresh) {
                setTimeout(() => this.refresh(), (result.expires_in / 2) * 1000);
            }
        }
        catch (e) {
            console.error(e);
            if (this.autorefresh) {
                setTimeout(() => this.refresh(), 60000);
            }
            else {
                throw e;
            }
        }
    }
    async init() {
        await this.refresh();
        let accountData = await this.getMainAccount();
        this.accountId = accountData.accountId;
    }
    request(url, qs) {
        let qsStr = qs ? '?' + querystring.stringify(qs) : '';
        return got(url + qsStr, {
            method: 'GET',
            json: true,
            headers: {
                authorization: 'Bearer ' + this.access_token,
            },
        }).then((res) => res.body);
    }
    async getOptionChain(options) {
        let url = `${HOST}/v1/marketdata/chains`;
        let qs = {
            symbol: options.symbol,
            strikeCount: options.near_the_money ? 30 : undefined,
            range: 'ALL',
            includeQuotes: 'TRUE',
            optionType: 'ALL',
            expMonth: 'ALL',
        };
        if (options.contract_type) {
            qs.contractType = options.contract_type;
        }
        if (options.to_date) {
            qs.toDate = options.to_date.toISOString();
        }
        if (options.from_date) {
            qs.fromDate = options.from_date.toISOString();
        }
        let result = await this.request(url, qs);
        function convertExpDateMapSymbols(expDateMap) {
            if (!expDateMap) {
                return;
            }
            _.each(expDateMap || {}, (strikes) => {
                _.each(strikes, (strike) => {
                    _.each(strike, (contract) => {
                        contract.symbol = tdaToOccSymbol(contract.symbol);
                    });
                });
            });
        }
        convertExpDateMapSymbols(result.callExpDateMap);
        convertExpDateMapSymbols(result.putExpDateMap);
        return result;
    }
    async getQuotes(symbols) {
        let url = `${HOST}/v1/marketdata/quotes`;
        let symbol_list = _.isArray(symbols) ? symbols : [symbols];
        let formatted_symbols = _.transform(symbol_list, (acc, s) => {
            let tda_symbol = occToTdaSymbol(s);
            acc[tda_symbol] = s;
        }, {});
        let qs = {
            symbol: _.keys(formatted_symbols).join(','),
        };
        let results = await this.request(url, qs);
        return _.transform(results, (acc, result, tda_symbol) => {
            let occ_symbol = formatted_symbols[tda_symbol];
            acc[occ_symbol] = result;
        }, {});
    }
    async getAccounts() {
        return this.request(`${HOST}/v1/accounts`);
    }
    async getMainAccount() {
        let accounts = await this.getAccounts();
        return _.values(accounts[0])[0];
    }
    async getTransactionHistory(options = {}) {
        let url = `${HOST}/v1/accounts/${this.accountId}/transactions`;
        let qs = Object.assign({ type: 'ALL' }, _.pick(options, ['symbol', 'startDate', 'endDate']));
        return this.request(url, qs);
    }
    async getTrades(options = {}) {
        let url = `${HOST}/v1/accounts/${this.accountId}/orders`;
        let qs = {
            fromEnteredTime: options.startDate,
            toEnteredTime: options.endDate,
        };
        let results = await this.request(url, qs);
        let trades = _.flatMap(results, (result) => {
            debug(result);
            let orders = [];
            let children = result.childOrderStrategies;
            if (children && children.length) {
                orders.push(..._.filter(children, (child) => child.status === 'FILLED' || child.filledQuantity > 0));
            }
            if (result.status === 'FILLED' || result.filledQuantity > 0) {
                orders.push(result);
            }
            return orders;
        });
        return _.map(trades, (trade) => {
            let latestExecution = new Date(0).toISOString();
            let executionPrices = _.chain(trade.orderActivityCollection)
                .flatMap((ex) => ex.executionLegs)
                .transform((acc, executionLeg) => {
                let legId = executionLeg.legId;
                let info = acc[legId] || { total: 0, size: 0 };
                info.total += executionLeg.quantity * executionLeg.price;
                info.size += executionLeg.quantity;
                acc[legId] = info;
                if (executionLeg.time > latestExecution) {
                    latestExecution = executionLeg.time;
                }
            }, [])
                .value();
            let legs = _.map(trade.orderLegCollection, (leg) => {
                let symbol = tdaToOccSymbol(leg.instrument.symbol);
                let multiplier = leg.instruction.startsWith('BUY') ? 1 : -1;
                let legPrices = executionPrices[leg.legId];
                let priceEach = legPrices.total / legPrices.size;
                return {
                    symbol,
                    price: priceEach,
                    size: legPrices.size * multiplier,
                };
            });
            return {
                id: trade.orderId,
                traded: trade.closeTime || latestExecution,
                price: trade.price,
                commissions: null,
                legs,
            };
        });
    }
}
exports.Api = Api;
//# sourceMappingURL=index.js.map