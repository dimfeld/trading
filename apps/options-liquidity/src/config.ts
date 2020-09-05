import * as _ from 'lodash';
import * as fs from 'fs';
import * as dashdash from 'dashdash';
import * as debugMod from 'debug';

import { parse_input } from './input';
import { Readable, Writable } from 'stream';
import { TdaAuthData } from 'trading-data';

const debug = debugMod('config');

export interface Config {
  calls: boolean;
  puts: boolean;
  input_format?: 'symbols' | 'trigger' | 'scheduler';
  output_format?: 'json' | 'text';
  scheduler: boolean;
  delta: number[];
  dte: string[];
  nonstandard?: boolean;

  max_spread_percent: number;
  min_open_interest: number;
  min_volume: number;

  auth?: string;
}

export function get_config(): {
  config: Config;
  auth: TdaAuthData;
  pipeline: Writable[];
} {
  let cmd_options = [
    {
      names: ['input-format', 'i'],
      type: 'string',
      help: `Input format.
symbols: list of symbols (default)
trigger: CMLViz trigger email
scheduler: earnings-trade-scheduler output`,
    },
    {
      names: ['file', 'f'],
      type: 'string',
      help:
        'Read input from a file. Otherwise reads from command line arguments or stdin',
    },
    {
      names: ['calls'],
      type: 'bool',
      help: 'Get call contract information',
    },
    {
      names: ['puts'],
      type: 'bool',
      help: 'Get put contract information',
    },
    {
      names: ['nonstandard', 'n'],
      type: 'bool',
      help: 'Consider nonstandard contracts',
    },
    {
      names: ['config', 'c'],
      type: 'string',
      help: 'Optional path to configuration file',
    },
    {
      names: ['delta', 'd'],
      type: 'arrayOfString',
      help: 'Deltas to examine (default 40)',
    },
    {
      names: ['dte', 'e'],
      type: 'arrayOfString',
      help:
        'DTE to examine. Append M to limit to monthly expirations (e.g. 7M)',
    },
    {
      names: ['auth'],
      type: 'string',
      help: `path to OAuth2 info file (JSON with refresh_token and client_id keys). default is 'tda_auth.json'`,
    },
    {
      names: ['output-format', 'o'],
      type: 'string',
      help: 'Output as json or text',
    },
    {
      names: ['max-spread-percent', 'sp'],
      type: 'number',
      help: 'Maximum allowable spread percent',
    },
    {
      names: ['min-open-interest', 'oi'],
      type: 'number',
      help: 'Minimum allowable open interest',
    },
    {
      names: ['min-volume', 'v'],
      type: 'number',
      help: 'Minimum allowable volume',
    },
  ];

  let args = dashdash.parse({ options: cmd_options });

  if (args.config) {
    let config_file = JSON.parse(fs.readFileSync(args.config).toString());
    args = {
      ...config_file,
      ...args,
    };
  }

  if (!args.delta || !args.delta.length) {
    args.delta = [0.4];
  }

  args.delta = _.map(args.delta, (delta) => {
    delta = Math.abs(delta);
    if (delta > 1) {
      delta /= 100;
    }
    return delta;
  });

  if (!args.dte || !args.dte.length) {
    args.dte = [28];
  }

  let auth_filename = args.auth || 'tda_auth.json';
  let auth = JSON.parse(fs.readFileSync(auth_filename).toString());

  let pipeline;
  if (args._args.length) {
    debug('Symbols', args._args);
    let items = args._args;
    pipeline = [
      new Readable({
        objectMode: true,
        read: function () {
          while (items.length) {
            if (!this.push(items.shift())) {
              return;
            }
          }

          if (!items.length) {
            this.push(null);
          }
        },
      }),
    ];
  } else {
    let input_stream = args.file
      ? fs.createReadStream(args.file)
      : process.stdin;
    pipeline = [input_stream, ...parse_input(args.input_format)];
  }

  debug('Config', args);
  return { config: args, auth, pipeline };
}
