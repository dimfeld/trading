import _, { Dictionary } from 'lodash';

import { entities, getPositionsAndTrades } from './entities';
import EntityInterface from '../state_manager/sync/lwwServer';
import { FastifyInstance } from 'fastify';

export default function(server: FastifyInstance, opts: any, next: () => void) {
  let entityInterface = new EntityInterface<any>({
    entities,
    readFilter: () => null,
    writeFilter: () => null,
    newItemValues: () => ({}),
  });

  server.route({
    url: '/entities',
    method: 'GET',
    handler: (req, res) => {
      let requests: Dictionary<string[]> = {};
      _.each(req.query, (val, key) => {
        if (entities[key]) {
          requests[key] = val.split(';');
        }
      });

      return entityInterface.read(null, requests);
    },
  });

  server.route({
    url: '/entities',
    method: 'POST',
    handler: (req, res) => {
      return entityInterface.update(null, req.body);
    },
  });

  server.route({
    url: '/base_data',
    method: 'GET',
    handler: async (req, res) => {
      let strategies = entityInterface.readAll(null, 'strategies');
      let tags = entityInterface.readAll(null, 'tags');
      let positions = getPositionsAndTrades('close_date IS NULL');

      return {
        strategies: await strategies,
        tags: await tags,
        positions: await positions,
      };
    },
  });

  server.route({
    url: '/positions',
    method: 'GET',
    handler: async (req, res) => {
      let positions = await getPositionsAndTrades('true');
      return { positions };
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
