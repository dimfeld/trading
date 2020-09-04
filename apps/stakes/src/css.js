const camelCaseToDash = (str) =>
  str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();

export default (props) =>
  Object.keys(props).reduce(
    (str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`,
    ''
  );
