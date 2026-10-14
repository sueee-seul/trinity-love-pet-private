import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { headObject, putObject } from '../services/object.storage.js';
import { taskMediaContentType } from '../services/task.media.js';
import { taskMediaKey } from '../services/task.photo.storage.js';

/**
 * Moves task photos and videos that were saved on a local disk, before they were kept in object
 * storage, into the shared store under the same names, so the media_logs rows find them again.
 * A file already in the store is left as it is. Safe to run again.
 *
 *   npm run media:upload-tasks --prefix Backend -- <folder>
 *
 * The folder defaults to Backend/storage/tasks.
 */

const DEFAULT_FOLDER = path.resolve(import.meta.dirname, '../../storage/tasks');

const isInStore = async (key: string): Promise<boolean> => {
  try {
    await headObject(key);
    return true;
  } catch (error: unknown) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
};

const main = async (): Promise<void> => {
  const folder = path.resolve(process.argv[2] ?? DEFAULT_FOLDER);
  const names = await readdir(folder);
  let uploaded = 0;
  let present = 0;
  for (const name of names) {
    const key = taskMediaKey(name);
    if (!key) continue;
    if (await isInStore(key)) {
      present += 1;
      continue;
    }
    await putObject({
      key,
      body: await readFile(path.join(folder, name)),
      contentType: taskMediaContentType(name),
      cacheControl: 'private, max-age=300',
    });
    uploaded += 1;
  }
  console.log(`Task media from ${folder}: ${uploaded} uploaded, ${present} already in the store.`);
};

await main();
