import {
  entities,
  read,
  create,
  update,
  del,
  getPositionsAndTrades,
  DbPosition,
  updatePositionAndTrades,
} from './entities';
import { FastifyInstance } from 'fastify';

function generateSimpleCrud(
  server: FastifyInstance,
  entity: keyof typeof entities
) {
  server.route({
    url: `/${entity}`,
    method: 'GET',
    handler: (req, res) => {
      return read({ entity });
    },
  });

  server.route({
    url: `/${entity}`,
    method: 'POST',
    handler: (req, res) => {
      return create(entity, req.body);
    },
  });

  server.route({
    url: `/${entity}/:id`,
    method: 'PUT',
    handler: (req, res) => {
      return update(entity, req.params.id, req.body);
    },
  });

  server.route({
    url: `/${entity}/:id`,
    method: 'DELETE',
    handler: (req, res) => {
      return del(entity, req.params.id);
    },
  });
}

export default function (server: FastifyInstance, opts: any, next: () => void) {
  generateSimpleCrud(server, 'strategies');
  generateSimpleCrud(server, 'tags');
  generateSimpleCrud(server, 'potential_positions');

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

  server.route({
    url: '/positions/:id',
    method: 'PUT',
    handler: async (req, res) => {
      return updatePositionAndTrades(req.params.id, req.body);
    },
  });

  next();
}
