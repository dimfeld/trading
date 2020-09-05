import * as _ from 'lodash';
import * as fs from 'fs';
import chalk from 'chalk';
import * as debug_factory from 'debug';

import { Brokers } from 'trading-data';
import { DbData, DbPosition, DbStrategies, Quote, AssetType } from 'types';
import { check_expired_legs } from './expired_legs';
import { writePositions } from 'trading-data';
import {
  print_trade_description,
  describe_position,
  format_money,
  describe_sorted_legs,
  describe_leg,
  sort_legs_for_display,
} from '../ui';

const debug = debug_factory('check_active');

interface Args {
  symbol?: string[];
  strategy?: string[];
  check_expired: boolean;
  check_active: boolean;
  combine: boolean;
}

export async function check_active(data: DbData, args: Args) {
  let position_chain = _.chain(data.positions).flatMap((x) => x);
  let hasSymbols = args.symbol && args.symbol.length;
  if (hasSymbols) {
    position_chain = position_chain.filter((p) =>
      _.includes(args.symbol, p.symbol)
    );
  }

  if (args.strategy) {
    position_chain = position_chain.filter((p: DbPosition) => {
      let strat_name = _.get(data.strategies[p.strategy], 'name');
      return _.includes(args.strategy, strat_name);
    });
  }

  let open_positions = position_chain.value();
  if (args.check_expired) {
    let updated_positions = check_expired_legs(open_positions);

    console.log('Removing expired legs...');
    if (updated_positions.length) {
      let newTrades = updated_positions.map((p) => {
        return {
          position: p.position.id,
          ...p.trade,
        };
      });

      await writePositions(
        updated_positions.map((up) => up.position),
        newTrades
      );
      _.each(updated_positions, (up) => {
        print_trade_description(up, data.strategies);
      });
    }
  }

  // if(args.combine && hasSymbols) {

  // }

  if (args.check_active) {
    let strategyTotals: _.Dictionary<ReturnType<typeof show_position>> = {};

    let legs = leg_list(args, open_positions);
    let quotes = await leg_prices(legs);

    console.log('Current positions:');

    let sorted_positions = _.orderBy(open_positions, [
      (x) => data.strategies[x.strategy].name,
      'symbol',
      'open_date',
    ]);

    _.each(sorted_positions, (position) => {
      if (position.close_date) {
        return;
      }

      let total = show_position(data.strategies, quotes, position);

      let existingTotal = strategyTotals[position.strategy];

      if (existingTotal) {
        existingTotal.cost_basis += total.cost_basis;
        existingTotal.closing_cost.current += total.closing_cost.current;
        existingTotal.closing_cost.change += total.closing_cost.change;
        existingTotal.realized += total.realized;
        existingTotal.total_pnl += total.total_pnl;
      } else {
        strategyTotals[position.strategy] = total;
      }

      console.log();
    });

    console.log('Strategy Totals');
    _.each(strategyTotals, (total, strategy) => {
      console.log(data.strategies[strategy].name);
      print_totals(total);
      console.log();
    });
  }
}

function leg_list(args: Args, positions: DbPosition[]) {
  let symbols = new Set<string>();

  _.each(positions, (p) => {
    _.each(p.legs, (leg) => {
      if (
        !args.symbol.length ||
        _.find(args.symbol, (allowed) => leg.symbol.startsWith(allowed))
      ) {
        symbols.add(leg.symbol);
      }
    });
  });

  return symbols;
}

const LEGS_PER_REQUEST = 100;
async function leg_prices(leg_set: Set<string>) {
  let legs = Array.from(leg_set);

  let auth_filename = process.env.AUTH_FILE || '../tda_auth.json';
  let auth = JSON.parse(fs.readFileSync(auth_filename).toString());
  let api = new Brokers({ tda: { auth } });
  await api.init();

  let results: _.Dictionary<Quote> = {};
  for (let i = 0; i < legs.length; i += LEGS_PER_REQUEST) {
    let theseSymbols = legs.slice(i, i + LEGS_PER_REQUEST);
    debug('Getting quotes', theseSymbols);
    let quotes = await api.getQuotes(theseSymbols);
    debug('Got quotes', _.keys(quotes));
    _.extend(results, quotes);
  }

  return results;
}

function cost_to_close(quotes: _.Dictionary<Quote>, position: DbPosition) {
  let total_current = 0;
  let total_change = 0;

  _.each(position.legs, (leg) => {
    let quote = quotes[leg.symbol];
    if (!quote) {
      console.error(`ERROR: No quote found for symbol ${leg.symbol}`);
      return;
    }

    let multiplier = quote.assetType === AssetType.Option ? 100 : 1;
    let total_size = multiplier * leg.size;
    total_current += total_size * quote.mark;
    total_change += total_size * quote.netChange;
    debug(
      'Symbol %s size %d mark %d change %d',
      leg.symbol,
      total_size,
      quote.mark,
      quote.netChange
    );
  });

  return { current: total_current, change: total_change };
}

function print_totals({ cost_basis, closing_cost, realized, total_pnl }) {
  let basis = format_money(cost_basis, false);
  let pnl_percent = (closing_cost.current + realized) / cost_basis;
  let pnl_pct_fmt = (100 * (-pnl_percent - 1)).toFixed(1);
  console.log(
    `Basis: ${basis}, Cost To Close: ${format_money(
      closing_cost.current,
      false
    )}, Total PnL: ${format_money(
      total_pnl
    )} ${pnl_pct_fmt}%, Unrealized Change: ${format_money(closing_cost.change)}`
  );
}

function show_position(
  strategies: DbStrategies,
  quotes: _.Dictionary<Quote>,
  position: DbPosition
) {
  if (position.close_date) {
    return;
  }

  let trade_gross = _.sumBy(position.trades, (t) => t.gross);
  let realized = trade_gross - position.cost_basis;
  let closing_cost = cost_to_close(quotes, position);
  let total_pnl = closing_cost.current + realized + position.cost_basis;

  let sorted_legs = sort_legs_for_display(position.legs);

  console.log(chalk.bold(describe_position(position, strategies)));
  let leg_desc = _.map(sorted_legs, (leg) => {
    let quote = quotes[leg.symbol] || { netChange: 0, closePrice: 1, mark: 1 };
    let desc = describe_leg(leg);
    let pct_change = format_money(quote.netChange / quote.closePrice, true, {
      prefix: '',
      suffix: '%',
    });
    return `${desc} ${format_money(quote.mark, false)}  ${format_money(
      quote.netChange
    )} ${pct_change}`;
  });
  _.each(leg_desc, (x) => console.log(x));

  let total = {
    cost_basis: position.cost_basis,
    closing_cost,
    realized,
    total_pnl,
  };
  print_totals(total);

  return total;
}
