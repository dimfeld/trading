#!/usr/bin/env ts-node
import * as _ from 'lodash';
import * as date from 'date-fns';
import { createBrokers } from 'trading-data';
import { BrokerChoice } from 'types';

(async () => {
  let api = await createBrokers();

  let startDate = date.setHours(new Date(), 23);
  startDate = date.subBusinessDays(startDate, 1);
  let endDate = date.addBusinessDays(new Date(startDate), 1);
  endDate = new Date();

  let data = await api.getOrders(BrokerChoice.tda, {
    startDate,
    endDate,
    filled: true,
    //startDate: '2020-08-27',
    //endDate: '2020-08-27',
  });

  console.log(JSON.stringify(data));
  return api.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
