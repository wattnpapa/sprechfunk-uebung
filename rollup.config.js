import autoprefixer from 'autoprefixer';
import postcss from 'rollup-plugin-postcss';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/app.ts',
  output: {
    dir: 'dist',
    entryFileNames: 'bundle.js',
    format: 'es',
    sourcemap: true,
    // Minifiziert Bundle und Chunks. Die Sourcemap bleibt erhalten, damit
    // Stacktraces im Error-Monitoring weiter auf die TypeScript-Quellen zeigen.
    plugins: [terser()],
  },
  treeshake: true,
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.ts'],
      dedupe: ['jspdf']
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
        },
        {
          // Nur die Subsets, die @fontsource-variable/*/index.css per @font-face
          // referenziert (url(./files/...) relativ zu bundle.css).
          src: [
            'node_modules/@fontsource-variable/archivo/files/archivo-*-wght-normal.woff2',
            'node_modules/@fontsource-variable/antonio/files/antonio-*-wght-normal.woff2'
          ],
          dest: 'dist/files'
        },
        {
          src: 'node_modules/pdfjs-dist/build/pdf.min.mjs',
          dest: 'dist/pdfjs',
          rename: 'pdf.min.js'
        },
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'dist/pdfjs',
          rename: 'pdf.worker.min.js'
        }
      ]
    })
  ]
};
