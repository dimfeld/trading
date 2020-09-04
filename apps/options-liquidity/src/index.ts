import { Transform } from 'stream';
import * as _ from 'lodash';
import * as syncthrough from 'syncthrough';
import * as makeDebug from 'debug';

import { get_config } from './config';
import { GetOptionChainOptions, Api } from 'tda-api';
import { analyzeLiquidity } from 'options-analysis';
import { format_json, format_text } from './analyze';

const debug = makeDebug('index');

process.on('uncaughtException', (e) => {
  console.error(e);
  process.exit(1);
});

process.on('unhandledRejection', (e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  let { config, auth, pipeline } = get_config();

  let api = new Api(auth);
  await api.init();

  let options : Partial<GetOptionChainOptions> = {
    include_nonstandard: config.nonstandard,
  };

  if(config.calls && !config.puts) {
    options.contract_type = 'CALL';
  } else if(config.puts && !config.calls) {
    options.contract_type = 'PUT';
  }

  let far_delta = _.some(config.delta, (delta) => {
    return delta < 0.3 || delta > 0.7;
  });

  if(!far_delta) {
    options.near_the_money = true;
  }

  let dte_nums = _.map(config.dte, (x) => Number.parseInt(x, 10));
  let min_dte = _.min(dte_nums);
  let max_dte = _.max(dte_nums);
  options.from_date = new Date();
  options.from_date.setDate(options.from_date.getDate() + min_dte);

  if(max_dte <= 60) {
    options.to_date = new Date();
    options.to_date.setDate(options.to_date.getDate() + max_dte + 60);
  }

  debug("Query options", options);

  var handle_err = function(e) {
    console.error('Error', e);
    process.exit(1);
  };

  let formatter =  config.output_format === 'json' ? format_json : format_text;

  pipeline.push(
    new Transform({
      objectMode: true,
      transform(item, enc, cb) {
        let symbol = item.symbol;
        let this_options = {
          ...options,
          symbol: symbol,
        };

        debug("Retrieving option chain for %s", symbol);
        try {
        api.getOptionChain(this_options)
          .then((result) => cb(null, { line: item.line, symbol, result }))
          .catch((err) => {
            debug("error", err);
            if(err.statusCode === 404) {
              cb();
            } else {
              cb(err);
            }
          });
        } catch(e) {
          debug("error", e);
          cb(e);
        }
      },
    }).on('error', handle_err),
    syncthrough((item) => {
      let liquidity = analyzeLiquidity(config, item.result);
      return {
        line: item.line,
        symbol: item.symbol,
        underlying: _.pick(item.result.underlying, ['last', 'change', 'highPrice', 'lowPrice', 'percentChange']),
        ...liquidity,
      };
    }),
    syncthrough(formatter),
  );

  let pipes = _.reduce(pipeline, (acc, stream) => {
    return acc.pipe(stream).on('error', handle_err);
  });

  pipes.on('end', () => {
    debug("DONE");
  });
  pipes.pipe(process.stdout, { end: false }).on('error', handle_err);
}

if(require.main === module) {
  main().catch(e => {
    console.error('Error', e);
    process.exit(1);
  });
}
