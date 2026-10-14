import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../contracts/auth.signup.contract.js';
import { pool } from '../config/database.js';
import { updateUserPasswordByEmail } from '../repositories/auth.repository.js';

const getEmailArgument = (): string => {
  const emailFlagIndex = process.argv.indexOf('--email');
  const email = emailFlagIndex >= 0 ? process.argv[emailFlagIndex + 1] : undefined;

  if (!email) {
    throw new Error('Usage: npm run auth:provision-password -- --email user@example.test');
  }

  return email;
};

const readHiddenInput = (prompt: string): Promise<string> => {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdin.setRawMode) {
    return Promise.reject(new Error('Password provisioning requires an interactive terminal'));
  }

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const cleanup = (): void => {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const onData = (chunk: Buffer): void => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Password provisioning cancelled'));
          return;
        }

        if (character === '\r' || character === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }

        if (character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
};

const validatePassword = (password: string): void => {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    );
  }

  if (!/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
    throw new Error('Password must contain at least one number and one symbol');
  }
};

const main = async (): Promise<void> => {
  const email = getEmailArgument();
  const password = await readHiddenInput('Password: ');
  const confirmation = await readHiddenInput('Confirm password: ');

  if (password !== confirmation) {
    throw new Error('Passwords do not match');
  }

  validatePassword(password);

  const updatedUser = await updateUserPasswordByEmail(email, password);
  if (!updatedUser) {
    throw new Error('User was not found');
  }

  console.log('Password hash updated.');
};

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Password provisioning failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
