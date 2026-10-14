import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const FINAL_SCHEMA_PATH = path.resolve(scriptsDirectory, '../database/neon.sql');
export const POSTGRES_API_TEST_LOCK_KEY = 'tropical-love-pet:postgres-api-tests';
const POSTGRES_API_TEST_TABLES = [
  'users',
  'pet_owners',
  'facilities',
  'employees',
  'employee_assignments',
  'pets',
  'feedback',
  'feedback_timeline_events',
  'notification',
  'reviewer_identities',
  'google_business_locations',
  'google_business_reviews',
  'external_feedback',
  'external_feedback_replies',
  'google_review_media_logs',
  'google_review_likes',
];

const TABLE_CONSTRAINT_NAMES = new Set([
  'primary',
  'foreign',
  'unique',
  'check',
  'constraint',
  'exclude',
  'references',
  'or',
  'on',
]);

const parseExpectedSchema = (schemaSql) => {
  const tables = new Map();
  const tablePattern =
    /(?:^|\n)\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi;

  for (const match of schemaSql.matchAll(tablePattern)) {
    const tableName = match[1]?.toLowerCase();
    const tableBody = match[2];
    if (!tableName || !tableBody) {
      continue;
    }

    const columns = new Set();
    for (const definition of tableBody.split(/\r?\n/)) {
      const columnName = definition.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/)?.[1];
      if (!columnName || TABLE_CONSTRAINT_NAMES.has(columnName.toLowerCase())) {
        continue;
      }
      columns.add(columnName.toLowerCase());
    }
    tables.set(tableName, columns);
  }

  return tables;
};

const getMissingSchemaItems = (expectedTables, actualTables, actualColumns) => {
  const missingTables = [...expectedTables.keys()].filter(
    (tableName) => !actualTables.has(tableName),
  );
  const missingColumns = [];

  for (const [tableName, expectedColumns] of expectedTables) {
    if (!actualTables.has(tableName)) {
      continue;
    }

    const columns = actualColumns.get(tableName) ?? new Set();
    for (const columnName of expectedColumns) {
      if (!columns.has(columnName)) {
        missingColumns.push(`${tableName}.${columnName}`);
      }
    }
  }

  return { missingTables, missingColumns };
};

const validateRequiredFixtures = async (client) => {
  const result = await client.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM users
         WHERE email = $1 AND is_employee = TRUE
       ) AS manager,
       EXISTS (
         SELECT 1
         FROM users AS u
         JOIN employees AS e ON e.users_uuid = u.uuid
         WHERE u.email = $1
           AND e.staff_role = 'manager'
       ) AS manager_employee,
       EXISTS (
         SELECT 1 FROM users
         WHERE email = $2 AND is_employee = TRUE
       ) AS staff,
       EXISTS (
         SELECT 1
         FROM users AS u
         JOIN employees AS e ON e.users_uuid = u.uuid
         WHERE u.email = $2
       ) AS staff_employee,
       EXISTS (
         SELECT 1 FROM users
         WHERE uuid = $3::uuid AND is_pet_owner = TRUE
       ) AS parent,
       EXISTS (
         SELECT 1 FROM pet_owners
         WHERE users_uuid = $3::uuid
       ) AS parent_profile,
       EXISTS (
         SELECT 1 FROM pets
         WHERE uuid = $4::uuid
       ) AS pet,
       EXISTS (
         SELECT 1 FROM facilities
         WHERE uuid = $5::uuid
       ) AS facility,
       EXISTS (
         SELECT 1 FROM employees
         WHERE users_uuid = $6::uuid
       ) AS employee,
       EXISTS (
         SELECT 1 FROM google_business_locations
         WHERE google_location_id = $7
       ) AS google_location`,
    [
      'manager@wagstay.com',
      'staff1@wagstay.com',
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000501',
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000201',
      'mock-pethouse-location',
    ],
  );

  const fixtureRow = result.rows[0] ?? {};
  const fixtureLabels = [
    ['manager user', fixtureRow.manager],
    ['manager employee row', fixtureRow.manager_employee],
    ['staff user', fixtureRow.staff],
    ['staff employee row', fixtureRow.staff_employee],
    ['parent user', fixtureRow.parent],
    ['parent profile', fixtureRow.parent_profile],
    ['pet', fixtureRow.pet],
    ['facility', fixtureRow.facility],
    ['employee', fixtureRow.employee],
    ['PetHouse Google location', fixtureRow.google_location],
  ];

  return fixtureLabels.filter(([, exists]) => exists !== true).map(([label]) => label);
};

export const validatePostgresApiTestDatabase = async (client) => {
  const schemaSql = await readFile(FINAL_SCHEMA_PATH, 'utf8');
  const expectedTables = parseExpectedSchema(schemaSql);
  if (expectedTables.size === 0) {
    throw new Error(`No CREATE TABLE definitions found in ${FINAL_SCHEMA_PATH}`);
  }

  const missingDefinitions = POSTGRES_API_TEST_TABLES.filter(
    (tableName) => !expectedTables.has(tableName),
  );
  if (missingDefinitions.length > 0) {
    throw new Error(
      [
        'Backend/database/neon.sql is missing PostgreSQL API test table definitions.',
        `- missing tables: ${missingDefinitions.join(', ')}`,
      ].join('\n'),
    );
  }

  const testedTables = new Map(
    POSTGRES_API_TEST_TABLES.map((tableName) => [tableName, expectedTables.get(tableName)]),
  );
  const tableNames = POSTGRES_API_TEST_TABLES;
  const tableResult = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name = ANY($1::text[])`,
    [tableNames],
  );
  const actualTables = new Set(tableResult.rows.map((row) => row.table_name));

  const columnResult = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames],
  );
  const actualColumns = new Map();
  for (const row of columnResult.rows) {
    const columns = actualColumns.get(row.table_name) ?? new Set();
    columns.add(row.column_name);
    actualColumns.set(row.table_name, columns);
  }

  const { missingTables, missingColumns } = getMissingSchemaItems(
    testedTables,
    actualTables,
    actualColumns,
  );
  if (missingTables.length > 0 || missingColumns.length > 0) {
    const problems = [];
    if (missingTables.length > 0) {
      problems.push(`missing tables: ${missingTables.join(', ')}`);
    }
    if (missingColumns.length > 0) {
      problems.push(`missing columns: ${missingColumns.join(', ')}`);
    }
    throw new Error(
      [
        'PostgreSQL API test database does not match Backend/database/neon.sql.',
        ...problems.map((problem) => `- ${problem}`),
      ].join('\n'),
    );
  }

  const missingFixtures = await validateRequiredFixtures(client);
  if (missingFixtures.length > 0) {
    throw new Error(
      `PostgreSQL API test database is missing required seed fixtures: ${missingFixtures.join(', ')}`,
    );
  }

  return {
    tableCount: testedTables.size,
    columnCount: [...testedTables.values()].reduce((count, columns) => count + columns.size, 0),
  };
};
