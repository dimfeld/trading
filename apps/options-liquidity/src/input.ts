import { Readable, Transform } from 'stream';
import * as split from 'split2';
import * as syncthrough from 'syncthrough';
import * as through from 'through2';
import * as debugMod from 'debug';

const debug = debugMod('input');

function parse_cml_trigger() {
  let first = true;
  let done = false;
  return function(line : string) {
    debug(line);
    if(done) {
      // Ignore all lines after we're done.
      return;
    }

    line = line.toString();
    if(first) {
      first = false;
      let m = /Triggers: ([A-Z]+) (.*)/.exec(line);
      if(m) {
        debug("Output", m[1]);
        return { symbol: m[1], line: `${m[1]} ${m[2]}` };
      }
    }

    if(line.startsWith('Notes:')) {
      debug("Done");
      done = true;
      return;
    }

    // Otherwise we either have a blank line or a symbol.
    let space = line.indexOf(' ');
    if(space > -1) {
      let symbol = line.slice(0, space).trim();
      if(symbol) {
        return { symbol, line };
      }
    }
  };
}

function parse_trade_scheduler(line) {
  // First set of uppercase characters on each line is the symbol.
  line = line.toString();
  debug(line);
  let m = / ([A-Z]+) /.exec(line);
  if(!m) {
    debug("No match for %s", line)
    return;
  }
  return { symbol: m[1], line };
}

export function parse_input(format : string) : Transform[] {

  let pipeline = [];

  debug("format", format);
  switch(format) {
    case 'trigger':
    case 'triggers':
      pipeline.push(split(), syncthrough(parse_cml_trigger()));
      break;
    case 'scheduler':
      pipeline.push(split(), syncthrough(parse_trade_scheduler));
      break;
    case '':
    case undefined:
      pipeline.push(split(/\s+/), syncthrough((x) => ({ symbol: x.toString().trim() }) ));
      break;
    default:
      throw new Error(`Unknown input format ${format}`);
  }

  // Don't send a symbol more than once.
  let seen = new Set();
  pipeline.push(through.obj(function(symbol, enc, cb) {
    if(!symbol || seen.has(symbol.symbol)) {
      return cb();
    }

    seen.add(symbol.symbol);
    this.push(symbol);
    cb();
  }));

  return pipeline;
}
