import { Router, Request, Response } from 'express';
import { SQLExecutor, ExecuteQueryRequest } from '../services/sqlExecutor';
import { SessionManager } from '../services/sessionManager';

const router = Router();
const sessionManager = new SessionManager();
const sqlExecutor = new SQLExecutor(sessionManager);

/**
 * POST /api/execute-query
 * Execute SQL query with DBML schema and data
 */
router.post('/execute-query', (req: Request, res: Response) => {
  try {
    const { sessionId, dbml, data, query } = req.body as ExecuteQueryRequest;

    // Validation
    if (!dbml || !query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dbml and query are required',
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Data must be an object with table names as keys',
      });
    }

    // Validate query
    const validation = sqlExecutor.validateQuery(query);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Execute query (sessionId is optional - will be created if not provided)
    const result = sqlExecutor.execute({ sessionId, dbml, data, query });

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'SQL Executor API is running',
    activeSessions: sessionManager.getActiveSessionsCount(),
  });
});

/**
 * DELETE /api/session/:sessionId
 * Delete a session
 */
router.delete('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    sessionManager.deleteSession(sessionId);
    res.json({ success: true, message: 'Session deleted' });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;

