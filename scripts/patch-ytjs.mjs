import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../node_modules/youtubei.js/dist/src/platform/jsruntime/default.js');

if (!existsSync(target)) {
  console.log('patch-ytjs: target not found, skipping');
  process.exit(0);
}

const patched = `import vm from 'vm';
export default function evaluate(data, env) {
  const code = typeof data === 'object' ? data.output : String(data);
  return vm.runInNewContext('(function(){' + code + '})()', Object.assign({ globalThis: {} }, env));
}
`;

writeFileSync(target, patched, 'utf8');
console.log('patch-ytjs: YouTubei.js evaluator patched with vm.runInNewContext');
