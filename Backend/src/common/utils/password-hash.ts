/**
 * Internal marker stored alongside the bcrypt hash for a manager-provisioned
 * password. The marker lives in the existing password_hash column; no schema
 * field is added for account activation state.
 */
export const TEMPORARY_PASSWORD_HASH_PREFIX = 'temporary:';
