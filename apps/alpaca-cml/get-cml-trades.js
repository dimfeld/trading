// ==UserScript==
// @name         Get CML Stock Trades Today
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Get latest CML Stock Trades
// @author       You
// @match        https://pro.trademachine.com/index.php
// @grant        none
// @run-at context-menu
// ==/UserScript==

(function() {
  'use strict';

    let triggers = Array.from(document.querySelectorAll("#today_container > div > div > div.today-data-area-small > div > table > tbody > tr"))
        .map((el) => {
            let [symbol, eff, closeAfter, triggered] = el.querySelectorAll('td');
            if(triggered.innerText !== 'Today') {
               return null;
            }

            let efficiencyScore = eff.innerText;
            if(efficiencyScore === '+max') {
                efficiencyScore = 1000;
            }

            let triggerType = symbol.getAttribute('data-template-type');

            return {
                symbol: symbol.innerText,
                type: triggerType,
                closeAfter: +closeAfter.innerText,
                efficiencyScore: +efficiencyScore,
            }
        })
        .filter(Boolean);

    console.log(JSON.stringify(triggers));

})();
