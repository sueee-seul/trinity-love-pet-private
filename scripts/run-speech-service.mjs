import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Starts the local Whisper speech service (SpeechService/server.py).
 *
 * Windows installs Python as `python`, macOS and most Linux distributions only as `python3`, so
 * an npm script cannot name one interpreter for the whole team.
 */

const serverPath = fileURLToPath(new URL('../SpeechService/server.py', import.meta.url));
const pythonCommand = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

const speechProcess = spawn(pythonCommand, ['-u', serverPath], {
  // Transcripts include Chinese; a Windows console otherwise prints them in the ANSI code page.
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!speechProcess.killed) {
      speechProcess.kill(signal);
    }
  });
}

speechProcess.on('error', (error) => {
  console.error(
    `Could not start the speech service with "${pythonCommand}": ${error.message}. ` +
      'Install Python 3.10+ and run pip install -r SpeechService/requirements.txt, ' +
      'or set PYTHON to your interpreter.',
  );
  process.exitCode = 1;
});

speechProcess.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
