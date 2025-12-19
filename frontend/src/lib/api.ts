import { ApiResponse, ErrorResponse, PaginationResponse } from '@/types';
import { API_URL } from '@/config/api';
import { getAccessToken } from './token';
import { refreshAccessToken } from './auth-client';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | string[] | number[] | undefined>;
}

class ApiError extends Error {
  statusCode: number;
  error?: string;

  constructor(message: string, statusCode: number, error?: string) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(
  response: Response,
  originalRequest?: { url: string; options?: RequestInit },
  retry = true
): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && retry && typeof window !== 'undefined' && originalRequest) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const token = getAccessToken();
        if (token) {
          const retryResponse = await fetch(originalRequest.url, {
            ...originalRequest.options,
            headers: {
              ...originalRequest.options?.headers,
              Authorization: `Bearer ${token}`,
            },
          });
          return handleResponse<T>(retryResponse, originalRequest, false);
        }
      }
    }
    
    const errorData = data as ErrorResponse;
    throw new ApiError(
      errorData.message || 'An error occurred',
      errorData.statusCode || response.status,
      errorData.error
    );
  }

  return data;
}

function buildUrl(endpoint: string, params?: Record<string, string | number | string[] | number[] | undefined>): string {
  const url = new URL(`${API_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            url.searchParams.append(key, String(item));
          });
        } else {
        url.searchParams.append(key, String(value));
        }
      }
    });
  }

  return url.toString();
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function apiGet<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options || {};
  const url = buildUrl(endpoint, params);

  const requestOptions = {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  };

  const response = await fetch(url, requestOptions);

  return handleResponse<ApiResponse<T>>(response, { url, options: requestOptions });
}

export async function apiGetPaginated<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<PaginationResponse<T>> {
  const { params, ...fetchOptions } = options || {};
  const url = buildUrl(endpoint, params);

  const requestOptions = {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  };

  const response = await fetch(url, requestOptions);

  return handleResponse<PaginationResponse<T>>(response, { url, options: requestOptions });
}

export async function apiPost<T, D = unknown>(
  endpoint: string,
  data?: D,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options || {};
  const url = buildUrl(endpoint, params);

  const requestOptions = {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...fetchOptions,
  };

  const response = await fetch(url, requestOptions);

  return handleResponse<ApiResponse<T>>(response, { url, options: requestOptions });
}

export async function apiPatch<T, D = unknown>(
  endpoint: string,
  data?: D,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options || {};
  const url = buildUrl(endpoint, params);

  const requestOptions = {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...fetchOptions,
  };

  const response = await fetch(url, requestOptions);

  return handleResponse<ApiResponse<T>>(response, { url, options: requestOptions });
}

export async function apiDelete<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options || {};
  const url = buildUrl(endpoint, params);

  const requestOptions = {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  };

  const response = await fetch(url, requestOptions);

  return handleResponse<ApiResponse<T>>(response, { url, options: requestOptions });
}

export { ApiError };
