import ky from 'ky-universal';

// @ts-ignore -- process.browser comes from rollup
const isBrowser = process.browser;

const apiPrefix = isBrowser
  ? ''
  : process.env.API_PATH || `http://localhost:${process.env.PORT || 3000}/`;

export default ky.extend({ prefixUrl: apiPrefix });
