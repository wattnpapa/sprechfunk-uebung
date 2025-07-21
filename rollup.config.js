import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/app.js',
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
  ],
};