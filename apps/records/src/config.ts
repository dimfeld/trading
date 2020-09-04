export var postgres = {
  url: process.env.TRADING_PG || 'postgres://trading@didev/trading',
  tables: {
    positions: 'positions',
    trades: 'trades',
    tags: 'tags',
  },
};
