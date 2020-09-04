#!/usr/bin/env ts-node
import * as db from './db';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as dashdash from 'dashdash';

import { parse_ib_email_subjects, parse_tw_emails, parse_tw_csv, parse_ib_tsv, parse_tos, manual } from './input';
import { DbData, UnderlyingWithTrade } from './types';
import { process_trades } from './process';
import { check_active } from './check_active';

function parse_cmd_line() {
  let options = [
    {
      names: ['ib-email'],
      type: 'string',
      help: 'Path to file containing IB notifier emails',
    },
    {
      names: ['tw-email'],
      type: 'string',
      help: 'Path to file containing Tastyworks emails',
    },
    {
      names: ['tw-csv'],
      type: 'string',
      help: 'Path to file containing Tastyworks CSV export',
    },
    {
      names: ['ib-tsv'],
      type: 'string',
      help: 'Path to file containing IB "classic" interface trades export',
    },
    {
      names: ['tos'],
      type: 'string',
      help: 'Path to file containing TOS trade information',
    },
    {
      names: ['manual'],
      type: 'bool',
      help: 'Enter a trade manually',
    },
    {
      names: ['check-active', 'c'],
      type: 'bool',
      help: 'Check the active positions',
    },
    {
      names: ['check-expired', 'e'],
      type: 'bool',
      help: 'Check for expired options',
    },
    {
      names: ['symbol', 's'],
      type: 'arrayOfString',
      help: 'Symbols to check',
    },
    {
      names: ['strategy', 'st'],
      type: 'arrayOfString',
      help: 'Strategies to check',
    },
    // {
    //   names: ['combine'],
    //   type: 'bool',
    //   help: 'combine positions together',
    // }
  ];

  return dashdash.parse({ options });
}

async function main() {
  let db_data = await db.load();
  let args = parse_cmd_line();

  args.symbol = _.chain(args.symbol)
    .flatMap((s) => s.split(','))
    .map(_.toUpper)
    .value();

  if(args.strategy) {
    args.strategy = _.flatMap(args.strategy, (s) => {
      switch(s) {
        case 'calls':
          return ['Preearnings', 'Profit Line', 'Bull Mammoth', 'Bull TTM Squeeze', 'Bear Mammoth', 'Bear TTM Squeeze', 'Bullish Technical Burst', 'Bearish Technical Burst'];
        case 'momentum':
          return ['Profit Line', 'Bull Mammoth', 'Bull TTM Squeeze', 'Bear Mammoth', 'Bear TTM Squeeze', 'Bullish Technical Burst', 'Bearish Technical Burst'];
        case 'short-term':
          return ['Preearnings', 'Omega', 'Profit Line', 'Bull Mammoth', 'Bull TTM Squeeze', 'Bear Mammoth', 'Bear TTM Squeeze', 'Bullish Technical Burst', 'Bearish Technical Burst', 'Likefolio Earnings', 'Postearnings Put Spreads', 'Postearnings Long Options', 'TM Strangle Alert', 'Earnings'];
      }
      return [s];
    });
  }

  if(args.check_active || args.combine || args.check_expired) {
    return check_active(db_data, args);
  }

  let data :  UnderlyingWithTrade[];
  if(args.ib_email) {
    let lines = fs.readFileSync(args.ib_email);
    data = await parse_ib_email_subjects(lines.toString(), db_data);
  } else if(args.tw_email) {
    let lines = fs.readFileSync(args.tw_email);
    data = parse_tw_emails(lines.toString());
  } else if(args.tw_csv) {
    let lines = fs.readFileSync(args.tw_csv);
    data = parse_tw_csv(lines.toString());
  } else if(args.ib_tsv) {
    let lines = fs.readFileSync(args.ib_tsv);
    data = parse_ib_tsv(lines.toString());
  } else if(args.manual) {
    data = await manual();
  } else if(args.tos) {
    let trades = JSON.parse(fs.readFileSync(args.tos).toString());
    data = parse_tos(trades);
  }
  await process_trades(db_data, data);
}

if(require.main === module) {
  main()
  .then(() => {
    db.pgp.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
