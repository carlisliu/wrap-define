import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  entry: './index.js',
  format: 'iife',
  globals: {
    window: 'window'
  },
  plugins: [
    json(),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true,
      skip: ['window']
    }),
    commonjs()
  ],
  dest: 'dist/bundle.js',
  moduleName: 'TINGYUN',
  interop: false
};