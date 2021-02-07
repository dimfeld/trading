import { entities, getPositionsAndTrades } from './entities';
import { FastifyInstance } from 'fastify';

export default function (server: FastifyInstance, opts: any, next: () => void) {
  let entityInterface = new EntityInterface<any>({
    entities,
    readFilter: () => null,
    writeFilter: () => null,
    newItemValues: () => ({}),
  });

  server.route({
    url: '/strategies',
    method: 'GET',
    handler: (req, res) => {
      return entityInterface.readAll(null, 'strategies');
    },
  });

  server.route({
    url: '/tags',
    method: 'GET',
    handler: async (req, res) => {
      return entityInterface.readAll(null, 'tags');
    },
  });

  server.route({
    url: '/positions',
    method: 'GET',
    handler: async (req, res) => {
      let positions = await getPositionsAndTrades(
        req.query.all ? 'true' : 'close_date IS NULL'
      );
      return positions;
    },
  });

  server.route({
    url: '/positions/:id',
    method: 'GET',
    handler: async (req, res) => {
      let result = await getPositionsAndTrades('positions.id=$[id]', {
        id: req.params.id,
      });

      return result[0];
    },
  });

  next();
}
