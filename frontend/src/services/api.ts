const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ExecuteQueryRequest {
  sessionId?: string;
  dbml: string;
  data: Record<string, any[]>;
  query: string;
}

export interface ExecuteQueryResponse {
  success: boolean;
  rows?: any[];
  columns?: string[];
  executionTime?: number;
  error?: string;
  sessionId?: string;
}

/**
 * Execute SQL query via backend API
 */
export async function executeQuery(
  request: ExecuteQueryRequest
): Promise<ExecuteQueryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to connect to server',
    };
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

