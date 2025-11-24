/**
 * Utility functions for Supabase error handling and retries
 */

export class SupabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

/**
 * Retry a Supabase operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('401')) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(
        `Supabase operation failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`,
        error
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new SupabaseError(
    `Operation failed after ${maxRetries} attempts: ${lastError?.message}`,
    'RETRY_EXHAUSTED',
    lastError
  );
}

/**
 * Handle Supabase API errors with helpful messages
 */
export function handleSupabaseError(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  // Network errors
  if (error.message?.includes('Failed to fetch')) {
    return 'Network error: Unable to connect to Supabase. Please check your internet connection and try again.';
  }

  // Authentication errors
  if (error.code === 'PGRST301' || error.message?.includes('invalid token')) {
    return 'Session expired. Please log in again.';
  }

  // Permission errors
  if (error.code === 'PGRST403' || error.status === 403) {
    return 'You do not have permission to perform this action.';
  }

  // Not found errors
  if (error.code === 'PGRST404' || error.status === 404) {
    return 'The requested resource was not found.';
  }

  // Rate limiting
  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Generic error
  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  return !!(url && key);
}

/**
 * Get Supabase configuration status
 */
export function getSupabaseConfigStatus(): {
  configured: boolean;
  url?: string;
  keyPresent: boolean;
} {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  return {
    configured: !!(url && key),
    url: url?.substring(0, 30) + '...',
    keyPresent: !!key,
  };
}
