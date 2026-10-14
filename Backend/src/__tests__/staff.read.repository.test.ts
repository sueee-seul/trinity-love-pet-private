import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

type Query = (sql: string, values?: readonly unknown[]) => Promise<QueryResult>;

const { withDatabaseConnectionMock } = vi.hoisted(() => ({
  withDatabaseConnectionMock: vi.fn(),
}));

vi.mock('../repositories/database.connection.js', () => ({
  withDatabaseConnection: withDatabaseConnectionMock,
}));

import { findManagerRecipient, listStaffOptions } from '../repositories/staff.read.repository.js';

const createClient = (result: QueryResult): { query: ReturnType<typeof vi.fn<Query>> } => ({
  query: vi.fn<Query>().mockResolvedValue(result),
});

const configureDatabase = (client: ReturnType<typeof createClient>): void => {
  withDatabaseConnectionMock.mockImplementationOnce(
    async (work: (databaseClient: typeof client) => Promise<unknown>): Promise<unknown> =>
      work(client),
  );
};

describe('Staff read repository directory queries', () => {
  beforeEach(() => {
    withDatabaseConnectionMock.mockReset();
  });

  it('lists employee options from PostgreSQL users and employees', async () => {
    const client = createClient({
      rows: [{ id: 'employee-uuid', name: 'Database Staff' }],
      rowCount: 1,
    });
    configureDatabase(client);

    await expect(listStaffOptions()).resolves.toEqual([
      { id: 'employee-uuid', name: 'Database Staff' },
    ]);

    const [query] = client.query.mock.calls[0] ?? [];
    expect(String(query)).toContain('JOIN employees e ON e.users_uuid = u.uuid');
    expect(String(query)).toContain('u.is_employee = TRUE');
    expect(String(query)).not.toContain('MOCK');
  });

  it('returns no manager recipient when PostgreSQL has no manager row', async () => {
    const client = createClient({ rows: [], rowCount: 0 });
    configureDatabase(client);

    await expect(findManagerRecipient()).resolves.toBeUndefined();

    const [query] = client.query.mock.calls[0] ?? [];
    expect(String(query)).toContain("e.staff_role = 'manager'");
  });
});
