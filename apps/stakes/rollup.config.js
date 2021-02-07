import * as path from 'path';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import svelte from 'rollup-plugin-svelte';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import config from 'sapper/config/rollup.js';
import colors from 'kleur';
import pkg from './package.json';
const svelteConfig = require('./svelte.config');

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const sourcemap = dev ? 'inline' : false;
const legacy = !!process.env.SAPPER_LEGACY_BUILD;

// Changes in these files will trigger a rebuild of the global CSS
const globalCSSWatchFiles = [
  'postcss.config.js',
  'tailwind.config.js',
  'src/global.pcss',
];

const onwarn = (warning, onwarn) => {
  // Transformed async function cause a lot of these errors.
  if (warning.code === 'THIS_IS_UNDEFINED') {
    return;
  }

  return (
    (warning.code === 'CIRCULAR_DEPENDENCY' &&
      /[/\\]@sapper[/\\]/.test(warning.message)) ||
    onwarn(warning)
  );
};
const dedupe = (importee) =>
  importee === 'svelte' || importee.startsWith('svelte/');

const babelServerConfig = {
  extensions: ['.js', '.mjs', '.html', '.svelte', '.ts'],
  exclude: ['node_modules/@babel/**'],
  babelHelpers: 'bundled',
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 12 },
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import',
    '@babel/proposal-class-properties',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-optional-chaining',
  ],
};

const babelClientConfig = {
  ...babelServerConfig,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { chrome: 85, safari: 14 }, // dev ? { chrome: 78 } : '> 0.25%, not dead',
      },
    ],
    '@babel/preset-typescript',
  ],
};

export default {
  client: {
    input: config.client.input(),
    output: { ...config.client.output(), sourcemap },
    plugins: [
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        compilerOptions: {
          dev,
          hydratable: true,
        },
        emitCss: true,
        preprocess: svelteConfig.preprocess,
      }),
      json(),

      babel(babelClientConfig),

      resolve({
        browser: true,
        extensions: ['.mjs', '.js', '.ts'],
        dedupe,
      }),
      commonjs(),

      // !dev &&
      //   terser({
      //     module: true,
      //   }),

      // From https://github.com/babichjacob/sapper-postcss-template/blob/main/rollup.config.js
      (() => {
        let builder;
        let rebuildNeeded = false;

        const buildGlobalCSS = () => {
          if (builder) {
            rebuildNeeded = true;
            return;
          }
          rebuildNeeded = false;
          const start = performance.now();

          try {
            builder = spawn('node', [
              '--experimental-modules',
              '--unhandled-rejections=strict',
              'build-global-css.mjs',
              sourcemap,
            ]);
            builder.stdout.pipe(process.stdout);
            builder.stderr.pipe(process.stderr);

            builder.on('close', (code) => {
              if (code === 0) {
                const elapsed = parseInt(performance.now() - start, 10);
                console.log(
                  `${colors
                    .bold()
                    .green(
                      '✔ global css'
                    )} (src/global.pcss → static/global.css${
                    sourcemap === true ? ' + static/global.css.map' : ''
                  }) ${colors.gray(`(${elapsed}ms)`)}`
                );
              } else if (code !== null) {
                if (dev) {
                  console.error(`global css builder exited with code ${code}`);
                  console.log(colors.bold().red('✗ global css'));
                } else {
                  throw new Error(
                    `global css builder exited with code ${code}`
                  );
                }
              }

              builder = undefined;

              if (rebuildNeeded) {
                console.log(
                  `\n${colors
                    .bold()
                    .italic()
                    .cyan('something')} changed. rebuilding...`
                );
                buildGlobalCSS();
              }
            });
          } catch (err) {
            console.log(colors.bold().red('✗ global css'));
            console.error(err);
          }
        };

        return {
          name: 'build-global-css',
          buildStart() {
            buildGlobalCSS();
            globalCSSWatchFiles.forEach((file) => this.addWatchFile(file));
          },
          generateBundle: buildGlobalCSS,
        };
      })(),
    ],

    preserveEntrySignatures: false,
    onwarn,
  },

  server: {
    input: config.server.input(),
    output: { ...config.server.output(), sourcemap },
    plugins: [
      replace({
        'process.browser': false,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      svelte({
        compilerOptions: {
          generate: 'ssr',
          dev,
        },
        preprocess: svelteConfig.preprocess,
      }),
      json(),
      babel(babelServerConfig),

      resolve({
        dedupe,
        extensions: ['.mjs', '.js', '.json', '.ts'],
      }),

      commonjs(),
    ],
    external: Object.keys(pkg.dependencies).concat(
      require('module').builtinModules ||
        Object.keys(process.binding('natives'))
    ),

    preserveEntrySignatures: 'strict',
    onwarn,
  },

  serviceworker: {
    input: config.serviceworker.input(),
    output: config.serviceworker.output(),
    plugins: [
      resolve(),
      replace({
        'process.browser': true,
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      !dev && babel(babelClientConfig),
      commonjs(),
      !dev && terser(),
    ],

    onwarn,
  },
};
