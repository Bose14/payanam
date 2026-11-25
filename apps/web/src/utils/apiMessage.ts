/** Best human-readable message from an axios error. */
export function apiMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: {
        message?: string;
        error?: { message?: string } | string;
      };
    };
    message?: string;
  };
  const data = e?.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'object' && typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  if (typeof e?.message === 'string' && !e.message.startsWith('Request failed')) return e.message;
  return fallback;
}
