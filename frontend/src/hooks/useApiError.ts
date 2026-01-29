import axios from 'axios';
import { useToast } from '../store/toastStore';

// RFC 9457 Problem Details format
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  request_id?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Parse an error into RFC 9457 ProblemDetail format.
 * Handles both RFC 9457 responses and legacy {"detail": "..."} format.
 */
export function parseApiError(error: unknown): ProblemDetail | null {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data;

    // Check if RFC 9457 format (has type, title, status)
    if (data.type && data.title && data.status) {
      return data as ProblemDetail;
    }

    // Fallback for legacy {"detail": "..."} format from FastAPI
    return {
      type: 'about:blank',
      title: 'Error',
      status: error.response.status,
      detail: data.detail || 'An error occurred',
      request_id: error.response.headers['x-request-id'],
    };
  }

  // Network error or other non-axios error
  if (error instanceof Error) {
    return {
      type: 'about:blank',
      title: 'Network Error',
      status: 0,
      detail: error.message || 'Could not connect to server. Check your internet connection.',
    };
  }

  return null;
}

/**
 * Hook to handle API errors and display them as toast notifications.
 * Automatically parses RFC 9457 error responses and shows user-friendly messages.
 */
export function useApiError() {
  const { showError } = useToast();

  const handleError = (error: unknown, fallbackTitle = 'Error') => {
    const problem = parseApiError(error);
    if (problem) {
      showError(
        problem.title || fallbackTitle,
        problem.detail,
        problem.request_id
      );
    } else {
      showError(fallbackTitle, 'An unexpected error occurred. Please try again.');
    }
  };

  return { handleError, parseApiError };
}
