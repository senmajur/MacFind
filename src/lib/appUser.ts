import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

type PostgrestErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorField = (error: unknown, field: keyof PostgrestErrorLike) => {
  if (!isRecord(error)) return null;
  const value = error[field];
  return typeof value === 'string' ? value : null;
};

export const extractReferencedTableFromForeignKeyError = (error: unknown) => {
  const details = getErrorField(error, 'details') ?? '';
  const message = getErrorField(error, 'message') ?? '';
  const combined = `${details}\n${message}`;

  const match = /is not present in table "([^"]+)"/i.exec(combined);
  if (match?.[1]) return match[1];
  return null;
};

const looksLikeMissingColumnError = (message: string) =>
  /Could not find the '([^']+)' column of '([^']+)'/.test(message);

const extractMissingColumnError = (message: string) => {
  const match = /Could not find the '([^']+)' column of '([^']+)'/.exec(message);
  if (!match?.[1] || !match?.[2]) return null;
  return { column: match[1], table: match[2] };
};

const looksLikeMissingTableError = (message: string, table: string) => {
  if (message.includes(`Could not find the table '${table}'`)) return true;
  if (message.includes(`Could not find the table "${table}"`)) return true;
  if (message.toLowerCase().includes('schema cache') && message.includes(table))
    return true;
  return false;
};

export const ensureUserRow = async (
  client: SupabaseClient,
  user: UserProfile,
  table = 'users',
) => {
  const localPart = user.email.split('@')[0] ?? user.email;
  const displayName = user.name?.trim() || localPart || user.email;

  const payload: Record<string, unknown> = { id: user.id, auth_id: user.id, email: user.email, display_name: displayName, avatar_url: null };

  const isRlsDenied = (message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes('row-level security') ||
      lower.includes('violates row-level security policy') ||
      lower.includes('permission denied')
    );
  };

  const isDuplicateKey = (error: unknown) => {
    const code = isRecord(error) ? error.code : null;
    if (code === '23505') return true;
    const message = getErrorField(error, 'message') ?? '';
    return message.toLowerCase().includes('duplicate key value violates unique constraint');
  };

  const extractNotNullColumn = (message: string) => {
    const match = /null value in column "([^"]+)"/i.exec(message);
    return match?.[1] ?? null;
  };

  const getFallbackForColumn = (column: string): unknown => {
    const lower = column.toLowerCase();
    if (lower === 'email') return user.email;
    if (lower === 'id' || lower === 'auth_id' || lower === 'user_id') return user.id;
    if (lower.includes('name')) return displayName;
    if (lower.includes('display')) return displayName;
    if (lower.includes('username') || lower.includes('macid') || lower.includes('handle'))
      return localPart;
    if (lower.includes('avatar')) return '';
    if (lower === 'created_at' || lower === 'updated_at') return new Date().toISOString();
    if (lower === 'role') return 'user';
    return null;
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await client.from(table).insert(payload);
    if (!error) return true;
    if (isDuplicateKey(error)) return true;

    const message = getErrorField(error, 'message') ?? '';
    const details = getErrorField(error, 'details') ?? '';
    const combined = `${message}\n${details}`;
    if (looksLikeMissingTableError(combined, table)) return false;

    if (isRlsDenied(combined)) {
      console.warn('ensureUserRow blocked by RLS/policy', {
        table,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return false;
    }

    if (looksLikeMissingColumnError(combined)) {
      const missing = extractMissingColumnError(combined);
      if (missing?.table === table) {
        delete payload[missing.column];
        continue;
      }
    }

    const notNullColumn = extractNotNullColumn(combined);
    if (notNullColumn) {
      const currentValue = payload[notNullColumn];
      if (currentValue === null || currentValue === undefined) {
        payload[notNullColumn] = getFallbackForColumn(notNullColumn);
        continue;
      }
    }

    console.warn('ensureUserRow failed', {
      table,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      payloadKeys: Object.keys(payload),
    });
    return false;
  }

  console.warn('ensureUserRow gave up after retries', {
    table,
    payloadKeys: Object.keys(payload),
  });
  return false;
};
