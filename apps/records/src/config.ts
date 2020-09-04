export var postgres = {
  url: process.env.TRADING_PG || 'postgres://trading@localhost/trading',
  tables: {
    positions: 'positions',
    trades: 'trades',
    tags: 'tags',
  },
};
