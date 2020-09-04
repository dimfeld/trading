#!/usr/bin/env ts-node
import * as _ from "lodash";
import { Api } from "tda-api";

(async () => {
  let nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 15);

  let api = new Api(require("../../tda_auth.json"), false);
  await api.init();
  let today = new Date();
  let day = _.padStart(today.getDate().toString(), 2, "0");
  let month = _.padStart((today.getMonth() + 1).toString(), 2, "0");

  let startDate = `${today.getFullYear()}-${month}-${day}`;
  let data = await api.getTrades({
    startDate,
    //startDate: '2020-08-27',
    //endDate: '2020-08-27',
  });

  console.log(JSON.stringify(data));
})().catch(console.error);
