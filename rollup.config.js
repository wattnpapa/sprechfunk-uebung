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
  // Keine externals mehr, alles wird ins Bundle gepackt
  plugins: [
    resolve({
      browser: true,      // prefer “browser” field in package.json
      preferBuiltins: false, // don’t auto-import Node core modules like “crypto”
      extensions: ['.js', '.ts'],
      dedupe: ['jspdf'] // Verhindere doppelte jsPDF-Instanzen
    }),
    commonjs({
      // Verhindere, dass jspdf/jspdf-autotable in CommonJS gewrappt werden!
      //exclude: ['node_modules/jspdf/**', 'node_modules/jspdf-autotable/**']
    }),
    typescript({ tsconfig: './tsconfig.json' }),
    postcss({
      extensions: ['.css'],
      extract: true,      // legt eine separate CSS-Datei an (z.B. dist/app.css)
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