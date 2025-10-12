import autoprefixer from 'autoprefixer';
import postcss from 'rollup-plugin-postcss';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/app.ts',
  output: {
    dir: 'dist',
    entryFileNames: 'bundle.js',
    format: 'es',
    sourcemap: true,
  },
  treeshake: false,
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.js', '.ts'],
      dedupe: ['jspdf', 'jquery']
    }),
    commonjs({
      include: ['node_modules/**'],
      transformMixedEsModules: true
    }),
    typescript({ tsconfig: './tsconfig.json' }),
    postcss({
      extensions: ['.css'],
      extract: true,
      minimize: true,
      plugins: [autoprefixer()],
    }),
    copy({
      targets: [
        {
          src: 'node_modules/@fortawesome/fontawesome-free/webfonts/*',
          dest: 'dist/webfonts'
        }
      ]
    })
  ],
};