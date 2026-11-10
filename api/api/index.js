// Vercel serverless entry. Vercel runs this plain JS file as one function; it loads the API that
// `npm run build` compiled into dist/ (we build with our own tsc, Vercel does not compile the TS).
// api/vercel.json rewrites every path here. Local and other hosts use src/server.ts instead.
require("reflect-metadata");
module.exports = require("../dist/app").default;
