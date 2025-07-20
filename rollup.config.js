import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/app.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    resolve({
      browser: true,      // prefer “browser” field in package.json
      preferBuiltins: false // don’t auto-import Node core modules like “crypto”
    }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
  ],
};