const production = process.env.NODE_ENV !== 'development';

module.exports = {
  plugins: [
    require('postcss-import')(),
    require('postcss-url')(),
    require('tailwindcss')('./tailwind.config.js'),
    require('autoprefixer')(),
    production && require('cssnano'),
  ].filter(Boolean),
};
