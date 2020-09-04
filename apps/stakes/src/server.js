import fastifyBuilder from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import sirv from 'sirv';
import compression from 'compression';
import * as sapper from '@sapper/server';
import './tailwind.css';

import dataController from './api/dataController';
import tradingData from './api/tradingData';

import { tdaApi } from './api/services';

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

function sapperMiddleware() {
  let sap = sapper.middleware();
  return (req, res, next) => {
    if (req.url.startsWith('/api')) {
      return next();
    }
    sap(req, res, next);
  };
}

async function start() {
  await tdaApi.init();

  const fastify = fastifyBuilder({ logger: true });

  fastify.register(fastifyHelmet);

  fastify.use(compression());
  fastify.use(sirv('static', { dev }));
  fastify.use(sapperMiddleware());

  fastify.register(dataController, { prefix: '/api' });
  fastify.register(tradingData, { prefix: '/api' });

  await fastify.listen(PORT, process.env.BIND_IP || '127.0.0.1');
  fastify.log.info(`server listening on ${PORT}`);
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
