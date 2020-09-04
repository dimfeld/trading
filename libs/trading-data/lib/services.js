"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pgp = void 0;
const pgp_mod = require("pg-promise");
const config = require("./config");
exports.pgp = pgp_mod();
exports.db = exports.pgp(config.postgres.url);
//# sourceMappingURL=services.js.map