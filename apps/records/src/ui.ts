import * as _ from 'lodash';
import chalk from 'chalk';
import { uid } from 'uid/secure';
import inquirer from 'inquirer';
import {
  Change,
  MatchingPositionScore,
  PositionChange,
  optionInfoFromSymbol,
} from 'options-analysis';
import {
  DbTrade,
  DbStrategy,
  DbStrategies,
  DbOptionLeg,
  BrokerChoice,
} from 'types';

import autocomplete from 'inquirer-autocomplete-prompt';
import fuzzy from 'fuzzy';

inquirer.registerPrompt('autocomplete', autocomplete);

import { DbPosition, DbData } from 'types';

export interface UnderlyingWithTrade {
  underlying: string;
  broker: BrokerChoice;
  trade: DbTrade;
}

export interface TradeMatches extends UnderlyingWithTrade {
  matches: Array<MatchingPositionScore<DbPosition>>;
}

export function format_money(
  amt: number,
  color = true,
  options = { prefix: '$', suffix: '' }
) {
  let f = options.prefix + amt.toFixed(2) + options.suffix;
  if (!color || (amt > -0.01 && amt < 0.01)) {
    return f;
  } else if (amt > 0) {
    return chalk.green(f);
  } else {
    return chalk.rgb(255, 40, 40)(f);
  }
}

export function describe_position(p: DbPosition, strategies: DbStrategies) {
  return `${p.symbol} ${
    strategies[p.strategy].name
  } opened ${p.open_date.toDateString()}`;
}

export function sort_legs_for_display(legs: DbOptionLeg[]) {
  return _.chain(legs)
    .map((leg) => {
      return { leg, info: optionInfoFromSymbol(leg.symbol) };
    })
    .orderBy(
      ['info.expiration', 'info.strike', 'info.call'],
      [true, true, false]
    )
    .map((info) => info.leg)
    .value();
}

export function describe_sorted_legs(legs: DbOptionLeg[]) {
  let sorted_legs = sort_legs_for_display(legs);
  return _.map(sorted_legs, describe_leg);
}

export function describe_leg(leg: DbOptionLeg) {
  let info = optionInfoFromSymbol(leg.symbol);
  let qWithSign = leg.size > 0 ? `+${leg.size}` : leg.size.toString();

  let is_option = Boolean(info.strike);
  if (!is_option) {
    return `${chalk.bold(qWithSign)} shares`;
  }

  let type = info.call ? 'CALL' : 'PUT';
  return `  ${chalk.bold(qWithSign)} ${info.expiration} ${info.strike} ${type}`;
}

export function print_trade_description(
  tp: PositionChange,
  strategies: DbStrategies
) {
  let pos = tp.position;
  let trade_gross = format_money(tp.trade.gross);
  let position_gross = format_money(tp.position.profit);
  let basis = format_money(Math.abs(tp.position.cost_basis), false);

  let description;
  if (tp.position.close_date) {
    description = chalk.blue('Closed position');
  } else if (tp.position.trades.length === 1) {
    description = chalk.green('Opened position');
  } else {
    switch (tp.change) {
      case Change.Opened:
        description = chalk.green('Added legs') + ' in';
        break;
      case Change.Closed:
        description = chalk.blue('Closed legs') + ' in';
        break;
      case Change.Reduced:
        description = chalk.red('Partial close') + ' in';
        break;
      default:
        description = chalk.magenta('Modified');
    }
  }

  let profit = `  Trade: ${trade_gross} Position: ${position_gross} from ${basis}`;

  let header = `${description} ${describe_position(pos, strategies)}`;

  let leg_description = describe_sorted_legs(tp.trade.legs);

  let message = [].concat(header, profit, leg_description).join('\n');
  console.log(message);
}

export function oneline_position_detail(db_data: DbData, position: DbPosition) {
  let legs = describe_sorted_legs(position.legs).join(', ');
  return `${describe_position(position, db_data.strategies)}: ${legs}`;
}

interface Choices {
  position: DbPosition | null | false;
  strategy: DbStrategy;
}

export async function position_for_unmatched_trade(
  m: TradeMatches,
  positions: DbPosition[],
  db_data: DbData
) {
  let { underlying, trade, matches } = m;

  let with_matches = new Set(_.map(matches, (p) => p.position.id));
  let choices: Array<{
    name: string;
    value: DbPosition | null | false;
  }> = _.chain(positions)
    .filter((p) => !with_matches.has(p.id))
    .map((p) => {
      return {
        overlapping: 0,
        score: 0,
        position: p,
      };
    })
    .concat(matches)
    .orderBy(['score', 'open_date'], ['desc', 'desc'])
    .map((p) => {
      let label = `${p.overlapping} overlapping legs (${
        p.score * 100
      }%) ${oneline_position_detail(db_data, p.position)}`;
      return {
        name: label,
        value: p.position,
      };
    })
    .value();

  let strategies = _.map(db_data.sorted_strategies, (s) => {
    return {
      name: s.name,
      value: s,
    };
  });

  let strategy_names = _.map(db_data.sorted_strategies, 'name');
  var search_strategies = function (answers, input) {
    let r = input
      ? fuzzy
          .filter(input, strategies, { extract: (x) => x.name })
          .map((r) => r.original)
      : strategies;
    return Promise.resolve(r);
  };

  choices.unshift({ name: 'Add new position', value: null });
  choices.push({ name: 'Ignore', value: false });

  let trade_desc = m.trade.note
    ? m.trade.note
    : `${m.underlying} ${m.trade.traded}`;
  console.log(chalk.bold(chalk.yellow('Select match for trade')), trade_desc);

  let leg_desc = describe_sorted_legs(m.trade.legs);
  _.each(leg_desc, (x) => console.log(x));

  let defaultChoice = choices.length == 2 ? 0 : 1;
  let chosen = await inquirer.prompt<Choices>([
    {
      type: 'list',
      name: 'position',
      message: 'Position',
      choices,
      when: choices.length > 1,
      default: defaultChoice,
    },
    {
      type: 'autocomplete',
      name: 'strategy',
      message: 'Trading Strategy',
      choices: strategies,
      default: 'Preearnings',
      when: (x) => x.position === null,
      source: search_strategies,
    } as any,
  ]);
  console.log();

  if (chosen.position === false) {
    return;
  }

  let position: DbPosition = chosen.position;

  if (!position) {
    position = {
      id: uid(),
      broker: null,
      open_date: new Date(trade.traded),
      close_date: null,
      legs: [],
      trades: [],
      symbol: underlying,
      strategy: chosen.strategy.id,
      tags: [],
      cost_basis: null,
      profit: null,
      buying_power: null,
      structure: null,
      note: null,
    };
  }

  return position;
}
