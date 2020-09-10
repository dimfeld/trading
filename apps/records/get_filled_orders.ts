#!/usr/bin/env ts-node
import * as _ from 'lodash';
import { createBrokers } from 'trading-data';
import { BrokerChoice } from 'types';

(async () => {
  let api = await createBrokers();
  let nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 15);

  let startDate = new Date();
  startDate.setHours(0);

  let data = await api.getOrders(BrokerChoice.tda, {
    startDate,
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
