import * as _ from 'lodash';
import * as inquirer from 'inquirer';
import { fullSymbol, occExpirationFromDate } from 'options-analysis';
import { IOptionLeg, IPosition, DbData } from './types';
import { oneline_position_detail } from './ui';

function parse_leg(underlying : string, desc : string) : IOptionLeg {
  let m = /(-?\d+ )?(.+) ([\d.]+) (PUT|CALL)/i.exec(desc);
  if(!m) {
    return null;
  }

  let [ , size, expiration, strike, type ] = m;

  let d = new Date(expiration.trim());
  if(!d) {
    return null;
  }

  let current_year = (new Date()).getFullYear()
  if(d.getFullYear() < current_year) {
    d.setFullYear(current_year);
  }
  let ex = occExpirationFromDate(d);

  type = _.toUpper(type);
  if(type !== 'CALL' && type !== 'PUT') {
    return null;
  }

  return {
    symbol: fullSymbol({ underlying, expiration: ex, strike: +strike, call: type === 'CALL' }),
    size: +size || 1,
  };
}

function validate_leg(underlying: string, desc : string) {
  let leg = parse_leg(underlying, desc);
  return leg ? true : 'Format: [SIZE] DATE STRIKE (PUT|CALL)';
}

export async function resolve_combo(symbol, size, price, date, db_data : DbData) {

  interface Combo {
    num_legs : string;
    leg1 : string;
    leg2 : string;
    leg3 : string;
    leg4 : string;
  }

  let validate = _.partial(validate_leg, symbol);

  let description = `the ${size} combo${size > 1 ? 's' : ''} for \$${price} in ${symbol} on ${date}`;

  let existing = db_data.positions[symbol] || [];
  let candidate_positions = _.filter(existing, (p) => Boolean(p.legs && p.legs.length));

  if(candidate_positions.length) {
    console.log(`Does ${description} match an existing position?`);
    interface Matching {
      position: string;
    };

    let choices = _.map(candidate_positions, (p) => {
      return {
        name: oneline_position_detail(db_data, p),
        value: p.id,
      }
    });

    let match = await inquirer.prompt<Matching>([
      {
        type: 'list',
        name: 'position',
        message: `Does ${description} match an existing position`,
        choices: [{ name: 'No match', value: '' }].concat(choices),
      },
    ]);

    if(match.position) {
      let position = _.find(candidate_positions, (p) => p.id === match.position);
      return _.map(position.legs, (leg) => {
        return { symbol: leg.symbol, size: size };
      });
    }
  }

  console.log(`Tell me about ${description}`);
  let data = await inquirer.prompt<Combo>([
    {
      type: 'input',
      name: 'num_legs',
      message: 'Number of legs (0 to fake it)',
      validate: (x) => (+x >= 0 && +x <= 4) ? true : 'must be a number from 0 through 4',
    },
    { type: 'input', name: 'leg1', message: 'First Leg', validate: validate, when: (x) => +x.num_legs > 0 },
    { type: 'input', name: 'leg2', message: 'Second Leg', validate: validate, when: (x) => +x.num_legs > 1 },
    { type: 'input', name: 'leg3', message: 'Third Leg', validate: validate, when: (x) => +x.num_legs > 2 },
    { type: 'input', name: 'leg4', message: 'Forth Leg', validate: validate, when: (x) => +x.num_legs > 3 },
  ]);

  let legs = _.compact([
    parse_leg(symbol, data.leg1),
    parse_leg(symbol, data.leg2),
    parse_leg(symbol, data.leg3),
    parse_leg(symbol, data.leg4),
  ]);

  if(legs.length === 0) {
    legs = [
      parse_leg(symbol, '1/1 50 call'),
      parse_leg(symbol, '1/1 50 put'),
    ];
  }

  _.each(legs, (leg) => {
    leg.size *= size;
  });

  return legs;
}
