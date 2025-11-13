import { SessionManager } from './sessionManager';

export interface ExecuteQueryRequest {
  sessionId?: string;
  dbml: string;
  data: Record<string, Record<string, unknown>[]>; // { tableName: [rows...] }
  query: string;
}

export interface ExecuteQueryResponse {
  success: boolean;
  rows?: unknown[];
  columns?: string[];
  executionTime?: number;
  error?: string;
  sessionId?: string;
}

/**
 * SQL Executor Service
 * Uses session-based approach for better scalability
 */
export class SQLExecutor {
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Execute SQL query with DBML schema and data
   * Uses session-based approach for better performance
   */
  execute(request: ExecuteQueryRequest): ExecuteQueryResponse {
    const startTime = Date.now();

    try {
      // Get or create session
      const sessionId = this.sessionManager.getOrCreateSession(
        request.sessionId || '',
        request.dbml,
        request.data
      );

      // Execute query on session database
      const result = this.sessionManager.executeQuery(sessionId, request.query);
      
      if (!result) {
        return {
          success: false,
          error: 'Session not found or expired',
          executionTime: Date.now() - startTime,
        };
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        rows: result.rows,
        columns: result.columns,
        executionTime,
        sessionId,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate SQL query syntax (basic validation)
   */
  validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, error: 'Query cannot be empty' };
    }

    // Remove comments to find the actual SQL statement
    let cleanedQuery = query
      // Remove single-line comments (-- comment)
      .replace(/--.*$/gm, '')
      // Remove multi-line comments (/* comment */)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (cleanedQuery.length === 0) {
      return { valid: false, error: 'Query cannot be empty' };
    }

    // Basic SQL injection prevention - only allow SELECT statements
    const trimmed = cleanedQuery.toUpperCase().trim();
    if (!trimmed.startsWith('SELECT')) {
      return { valid: false, error: 'Only SELECT queries are allowed' };
    }

    // Check for dangerous keywords (but allow them in comments which are already removed)
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      // Use word boundary to avoid false positives (e.g., "SELECTED" shouldn't match "DELETE")
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleanedQuery)) {
        return { valid: false, error: `Query contains forbidden keyword: ${keyword}` };
      }
    }

    return { valid: true };
  }
}

