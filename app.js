const fs = require('fs');
const path = require('path');

// Recreate .env symlink after each deploy (Hostinger git clean removes untracked files)
const envPath = path.join(__dirname, '.env');
const safePath = path.join(process.env.HOME || '/home/u775839017', '.veriaapp.env');

console.log('[ENV] HOME:', process.env.HOME);
console.log('[ENV] envPath exists:', fs.existsSync(envPath));
console.log('[ENV] safePath:', safePath, 'exists:', fs.existsSync(safePath));

if (!fs.existsSync(envPath) && fs.existsSync(safePath)) {
  try {
    fs.symlinkSync(safePath, envPath);
    console.log('[ENV] symlink created OK');
  } catch (e) {
    console.log('[ENV] symlink error:', e.message);
    // fallback: copy the file
    try {
      fs.copyFileSync(safePath, envPath);
      console.log('[ENV] file copied OK');
    } catch (e2) {
      console.log('[ENV] copy error:', e2.message);
    }
  }
}

require('dotenv').config();
const { startServer } = require('./src/server');

startServer();
