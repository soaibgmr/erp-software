// Vercel serverless entry. Vercel runs this plain JS file as one function; it loads the CommonJS
// bundle that `npm run build && npm run bundle` produced (src/vercel.ts → dist/bundle/vercel.cjs).
// We compile and bundle ourselves; Vercel does not compile the TS. api/vercel.json rewrites every
// path here. Local and other long-running hosts use src/server.ts instead.
module.exports = require("../dist/bundle/vercel.cjs").default;
