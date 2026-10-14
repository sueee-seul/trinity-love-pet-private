import type { PoolClient } from 'pg';

export const lockAndVerifyFeedbackRecords = async (
  client: PoolClient,
  uniqueUuids: string[],
): Promise<{ missingUuids: string[] }> => {
  const existingResult = await client.query<{ uuid: string }>(
    `SELECT uuid::text AS uuid
     FROM feedback
     WHERE uuid = ANY($1::uuid[])
     FOR UPDATE`,
    [uniqueUuids],
  );
  const existingUuids = new Set(existingResult.rows.map((row) => row.uuid));
  const missingUuids = uniqueUuids.filter((uuid) => !existingUuids.has(uuid));

  return { missingUuids };
};
