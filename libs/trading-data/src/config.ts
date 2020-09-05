export var postgres = {
  url: process.env.TRADING_PG || 'postgres://trading@diserver/trading',
  tables: {
    positions: 'positions',
    trades: 'trades',
    tags: 'tags',
    historical_equity_prices: 'historical_equity_prices',
  },
};
