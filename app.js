const fs = require('fs');
const path = require('path');

// Recreate .env symlink after each deploy (Hostinger git clean removes untracked files)
const envPath = path.join(__dirname, '.env');
const safePath = path.join(process.env.HOME || '/home/u775839017', '.veriaapp.env');

if (!fs.existsSync(envPath) && fs.existsSync(safePath)) {
  try {
    fs.symlinkSync(safePath, envPath);
  } catch (e) {
    try { fs.copyFileSync(safePath, envPath); } catch {}
  }
}

require('dotenv').config();
const { startServer } = require('./src/server');

startServer();
