import { ContainerSandboxManager, SupportedEngine } from './containerSandboxManager';

export interface ExecuteQueryRequest {
  sessionId?: string;
  dbml: string;
  data: Record<string, Record<string, unknown>[]>; // { tableName: [rows...] }
  query: string;
  engine?: SupportedEngine;
}

export interface ExecuteQueryResponse {
  success: boolean;
  rows?: unknown[];
  columns?: string[];
  executionTime?: number;
  error?: string;
  sessionId?: string;
  engine?: SupportedEngine;
}

/**
 * SQL Executor Service
 * Runs queries inside isolated container sandboxes
 */
export class SQLExecutor {
  private sandboxManager: ContainerSandboxManager;

  constructor(sandboxManager: ContainerSandboxManager) {
    this.sandboxManager = sandboxManager;
  }

  /**
   * Execute SQL query within sandbox container
   */
  async execute(request: ExecuteQueryRequest): Promise<ExecuteQueryResponse> {
    const startTime = Date.now();

    try {
      // Get or create sandbox for session
      const sandbox = await this.sandboxManager.getOrCreateSandbox({
        sessionId: request.sessionId,
        dbml: request.dbml,
        data: request.data,
        engine: request.engine,
      });

      // Execute query inside sandbox container
      const result = await this.sandboxManager.executeQuery(sandbox.sessionId, request.query);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        rows: result.rows,
        columns: result.columns,
        executionTime,
        sessionId: sandbox.sessionId,
        engine: sandbox.engine,
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

    return { valid: true };
  }
}

