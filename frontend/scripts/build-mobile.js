const { spawnSync } = require('child_process');

const backendUrl = process.env.REACT_APP_BACKEND_URL;
if (!backendUrl || !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(backendUrl)) {
  console.error('Configura REACT_APP_BACKEND_URL con la URL HTTPS del backend antes de crear la app móvil.');
  process.exit(1);
}

for (const [command, args] of [
  ['npm', ['run', 'build']],
  ['npx', ['cap', 'sync']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
