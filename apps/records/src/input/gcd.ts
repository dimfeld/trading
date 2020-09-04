import * as _ from 'lodash';

function gcd_two(one : number, two : number) {
  let [larger, smaller] = one > two ? [one, two] : [two, one];

  while(true) {
    // if the remainder of larger / smaller is 0, they are the same
    // so return smaller as the GCD
    let mod = larger % smaller;
    if(mod === 0) {
      return smaller;
    }

    // otherwise, the new larger number is the old smaller number, and
    // the new smaller number is the remainder
    larger = smaller;
    smaller = mod;
  }
}

export function gcd(numbers : number[]) {
  return _.reduce(numbers.slice(1), (acc, input) => {
    return gcd_two(acc, input);
  }, numbers[0]);
}

export function lcm(numbers : number[])
{
  return _.reduce(numbers.slice(1), (acc, input) => {
    return (acc * input) / gcd_two(acc, input);
  }, numbers[0]);
}
