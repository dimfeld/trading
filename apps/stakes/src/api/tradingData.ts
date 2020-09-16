import { Dictionary } from 'lodash';
import { FastifyInstance } from 'fastify';
import { brokers } from './services';
import got from 'got';
import { GetOptionChainOptions } from 'trading-data';
import addDays from 'date-fns/addDays';
import { BarTimeframe } from '../../../../libs/trading-data/node_modules/types/lib';

export default function (server: FastifyInstance, opts: any, next: () => void) {
  server.route({
    url: '/quotes',
    method: 'POST',
    handler: (req, res) => {
      return brokers.getQuotes(req.body.symbols);
    },
  });

  server.route({
    url: '/ma',
    method: 'POST',
    handler: async (req, res) => {
      let { symbols } = req.body;
      let qs = {
        auth: 'DEV1_nr82759gjRJ9Qm59FJbnqpeotr',
        tickers: symbols.join(','),
      };
      let data: any[] = await got({
        url: `https://webservice.cmlviz.com/GetLiveTechnicals`,
        searchParams: qs,
      }).json();

      let result: Dictionary<any> = {};
      for (let item of data) {
        result[item.Ticker] = item;
      }
      return result;
    },
  });

  server.route({
    url: '/bars',
    method: 'POST',
    handler: async (req, res) => {
      let {
        symbols,
        timeframe,
      }: { symbols: string[]; timeframe?: BarTimeframe } = req.body;
      let bars = await brokers.getBars({
        symbols,
        timeframe: timeframe || BarTimeframe.day,
      });

      return Object.fromEntries(bars.entries());
    },
  });

  server.route({
    url: '/chain/:symbol',
    method: 'POST',
    handler: async (req, res) => {
      let body = req.body || {};

      // Always get at least 60 days out.
      let dte = Math.min(body.dte || 60, 60);

      let options: GetOptionChainOptions = {
        symbol: req.params.symbol,
        contract_type: body.contractType,
        near_the_money: !body.farDeltas,
        from_date: new Date(),
        to_date: addDays(new Date(), dte),
      };

      return brokers.getOptionChain(options);
    },
  });

  next();
}
