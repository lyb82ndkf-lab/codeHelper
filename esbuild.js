const esbuild = require('esbuild');
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true, format: 'cjs', minify: production,
  sourcemap: !production, sourcesContent: false,
  platform: 'node', outfile: 'dist/extension.js',
  external: ['vscode'], logLevel: 'info',
};

(async () => {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[esbuild] watching...');
  } else {
    await esbuild.build(buildOptions);
    console.log('[esbuild] done');
  }
})().catch(e => { console.error(e); process.exit(1); });
