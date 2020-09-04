import _, { Dictionary } from 'lodash';
import { pgp, db } from '../../api/services';
import { ColumnSet, Column } from 'pg-promise';
import { Versionable } from '../types';

export interface EntityDef<T> {
  // True if there is at most one row per call.
  // e.g. a row full of per-user preferences.
  singleton: boolean;

  columns: ColumnSet;

  // True if we need to cast the ID parameters to integers.
  idIsInt?: boolean;

  // Generally these functions should return something like `user_id=${context.user_id}`.
  // If these are omitted, the global functions are used instead.
  readFilter?: (context: T, entityType: string) => string | null;
  writeFilter?: (context: T, entityType: string) => string | null;
  // Values that should be assigned to new database items.
  // Generally this will return an object like { user_id: context.user_id }.
  newItemValues?: (context: T, entityType: string) => Dictionary<any>;
}

interface Entity<T> extends EntityDef<T> {
  updateClause: string;
  readFilter: (context: T, entityType: string) => string | null;
  writeFilter: (context: T, entityType: string) => string | null;
  newItemValues: (context: T, entityType: string) => Dictionary<any>;
}

interface EntityInterfaceOptions<T> {
  entities: Dictionary<EntityDef<T>>;

  // global filter functions to use if the entity doesn't have its own
  readFilter: (context: T, entityType: string) => string | null;
  writeFilter: (context: T, entityType: string) => string | null;
  newItemValues: (context: T, entityType: string) => Dictionary<any>;
}

export default class EntityInterface<T> {
  entities: Dictionary<Entity<T>>;

  constructor(options: EntityInterfaceOptions<T>) {
    this.entities = _.transform(
      options.entities,
      (acc: Dictionary<Entity<T>>, entity, entityName) => {
        let table = entity.columns.table.toString();
        let updateClause = entity.columns.columns
          .filter((column) => !column.cnd)
          .map((column) => {
            return `${column.escapedName}=EXCLUDED.${column.escapedName}`;
          })
          .concat([`version=${table}.version+1`])
          .join(',\n');

        acc[entityName] = {
          ...entity,
          updateClause,
          readFilter: entity.readFilter || options.readFilter,
          writeFilter: entity.writeFilter || options.writeFilter,
          newItemValues: entity.newItemValues || options.newItemValues,
        };
      },
      {}
    );
  }

  private doQuery(entity: Entity<T>, items: any[], writeFilter: string | null) {
    let queryInsert = pgp.helpers.insert(items, entity.columns);
    let query = `${queryInsert}
      ON CONFLICT(id) DO UPDATE SET
      ${entity.updateClause}
      ${writeFilter ? 'WHERE ' + writeFilter : ''}
      RETURNING *`;

    return db.query(query);
  }

  private async doDeletes(
    entity: Entity<T>,
    items: string[],
    writeFilter: string | null
  ) {
    let whereClause = writeFilter ? 'AND ' + writeFilter : '';

    let idParams: number[] | string[] = items;
    if (entity.idIsInt) {
      idParams = items.map((i) => +i);
    }

    // TODO This screws up the versioning. Better to use a tombstone flag for better usage.
    let results = await db.query(
      `DELETE FROM ${entity.columns.table.toString()}
      WHERE id=ANY($[ids]) ${whereClause} RETURNING id`,
      { ids: idParams }
    );

    return results.map((row: any) => {
      return {
        id: row.id,
        _deleted: true,
      };
    });
  }

  async updateDictionary(
    entity: Entity<T>,
    data: Dictionary<Versionable>,
    newItemValues: Dictionary<any>,
    writeFilter: string | null
  ) {
    let deletes: string[] = [];
    let inserts: any[] = [];

    _.each(data, (item, id) => {
      if (item) {
        inserts.push({
          ...item,
          ...newItemValues,
          version: 0,
          id: id,
        });
      } else {
        deletes.push(id);
      }
    });

    let insertPromise = inserts.length
      ? this.doQuery(entity, inserts, writeFilter)
      : [];

    let deletePromise = deletes.length
      ? this.doDeletes(entity, deletes, writeFilter)
      : [];

    let [insertResult, deleteResult] = await Promise.all([
      insertPromise,
      deletePromise,
    ]);

    return insertResult.concat(deleteResult);
  }

  async updateSingleton(
    entity: Entity<T>,
    data: Versionable,
    newItemValues: Dictionary<any>,
    writeFilter: string | null
  ) {
    let insertData = {
      ...data,
      ...(newItemValues || {}),
      version: 0,
    };

    return this.doQuery(entity, [insertData], writeFilter);
  }

  async update(
    context: T,
    data: Dictionary<Versionable | Dictionary<Versionable>>
  ) {
    let promises = _.map(data, async (entityData, entityType) => {
      let entity = this.entities[entityType];
      if (!entity) {
        throw new Error(`Unknown entity ${entityType}`);
      }

      let writeFilter = entity.writeFilter(context, entityType);
      let newItemValues = entity.newItemValues(context, entityType);
      let results: any[];
      if (entity.singleton) {
        results = await this.updateSingleton(
          entity,
          entityData as Versionable,
          newItemValues,
          writeFilter
        );
      } else {
        results = await this.updateDictionary(
          entity,
          entityData as Dictionary<Versionable>,
          newItemValues,
          writeFilter
        );
      }

      return { entityType, singleton: entity.singleton, results };
    });

    return this.resolveResults(await Promise.all(promises));
  }

  async read(context: T, data: Dictionary<string[]>) {
    let promises = _.map(data, async (ids, entityType) => {
      let entity = this.entities[entityType];
      if (!entity) {
        throw new Error(`Unknown entity ${entityType}`);
      }

      let idsFilter: string | undefined;
      let idParams: number[] | string[] = ids;

      let getAll = idParams.length === 0 || idParams[0] === '*';
      if (!getAll) {
        idsFilter = 'id=ANY($[ids])';
        if (entity.idIsInt) {
          idParams = ids.map((i) => +i);
        }
      }

      let filters = [idsFilter, entity.readFilter(context, entityType)]
        .filter(Boolean)
        .join(' AND ');
      let query = `SELECT *
        FROM ${entity.columns.table.toString()}
        ${filters ? 'WHERE ' + filters : ''}`;

      let results = await db.query(query, { ids: idParams });
      return { entityType, singleton: entity.singleton, results };
    });

    return this.resolveResults(await Promise.all(promises));
  }

  async readAll(context: T, entityType: string, extraConditions?: string[]) {
    let entity = this.entities[entityType];
    if (!entity) {
      throw new Error(`Unknown entity ${entityType}`);
    }

    let readFilter = entity.readFilter(context, entityType);
    let whereFilters = [readFilter, ...(extraConditions || [])]
      .filter(Boolean)
      .join(' AND ');

    let results = await db.query(`SELECT *
      FROM ${entity.columns.table.toString()}
      ${whereFilters ? 'WHERE ' + whereFilters : ''}`);

    let output = this.resolveResults([
      { entityType, singleton: entity.singleton, results },
    ]);
    return output[entityType];
  }

  resolveResults(
    entityResults: Array<{
      entityType: string;
      singleton: boolean;
      results: any[];
    }>
  ) {
    let output: Dictionary<any> = {};
    entityResults.forEach(({ entityType, singleton, results }) => {
      if (singleton) {
        output[entityType] = results[0];
      } else {
        let entityOutput: Dictionary<any> = {};
        results.forEach((result) => {
          entityOutput[result.id] = result._deleted ? null : result;
        });
        output[entityType] = entityOutput;
      }
    });
    return output;
  }
}
