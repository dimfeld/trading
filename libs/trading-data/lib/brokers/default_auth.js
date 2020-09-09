"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAlpacaAuth = exports.defaultTdaAuth = void 0;
const findUp = require("find-up");
function defaultTdaAuth() {
    let file = findUp.sync('tda_auth.json');
    let data = require(file);
    return {
        client_id: data.client_id,
        refresh_token: data.refresh_token,
    };
}
exports.defaultTdaAuth = defaultTdaAuth;
function defaultAlpacaAuth(paper = true) {
    let path = paper ? 'alpaca_auth_paper.json' : 'alpaca_auth.json';
    let file = findUp.sync(path);
    let data = require(file);
    return {
        key: data.key,
        secret: data.secret,
        paper,
    };
}
exports.defaultAlpacaAuth = defaultAlpacaAuth;
//# sourceMappingURL=default_auth.js.map