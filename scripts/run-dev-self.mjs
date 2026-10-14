import { spawn } from 'node:child_process';

const selfDatabaseUrl = process.env.SELF_DATABASE_URL;

if (!selfDatabaseUrl) {
  console.error('SELF_DATABASE_URL is required for npm run dev:self.');
  process.exit(1);
}

const childEnvironment = {
  ...process.env,
  POSTGRESQL_URL: selfDatabaseUrl,
  LLM_BASE_URL: 'http://127.0.0.1:11434/api',
  LLM_MODEL: 'qwen2.5-coder:14b',
  LLM_API_KEY: 'ollama',
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const devProcess = spawn(npmCommand, ['run', 'dev'], {
  env: childEnvironment,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!devProcess.killed) {
      devProcess.kill(signal);
    }
  });
}

devProcess.on('error', (error) => {
  console.error('Could not start npm run dev:', error.message);
  process.exitCode = 1;
});

devProcess.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
