// server.js
// Entry point — connects DB then starts Express.
// app.js is the pure Express factory; this file owns the I/O side-effects.
require('dotenv').config();

const connectDB = require('./src/config/db');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] VELoop backend running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
})();
