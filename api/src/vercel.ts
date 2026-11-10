// Vercel entry, bundled by `npm run bundle` into dist/bundle/vercel.cjs and loaded by api/index.js.
// Vercel's Node runtime cannot require() ES modules (inversify, @erp-software/shared, …), so esbuild
// turns the whole API into one CommonJS file. It sits two folders below api/ (like dist/config), so
// paths resolved from __dirname (load-env.ts, database-url.ts) still point at the api folder.
import "reflect-metadata";
import app from "./app";

export default app;
