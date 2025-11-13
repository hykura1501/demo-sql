import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { parseDBML, generateSQLSchema } from '../parser/dbmlParser';

export interface SessionData {
  sessionId: string;
  dbml: string;
  data: Record<string, Record<string, unknown>[]>;
  createdAt: number;
  lastAccessed: number;
}

/**
 * Session Manager
 * Manages user sessions with persistent SQLite databases
 */
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private dbConnections: Map<string, Database.Database> = new Map();
  private dbDir: string;
  private sessionTimeout: number; // milliseconds

  constructor(dbDir: string = './sessions', sessionTimeout: number = 30 * 60 * 1000) {
    this.dbDir = dbDir;
    this.sessionTimeout = sessionTimeout; // 30 minutes default

    // Ensure sessions directory exists
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }

    // Cleanup old sessions on startup
    this.cleanupOldSessions();

    // Periodic cleanup
    setInterval(() => this.cleanupOldSessions(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Create or get existing session
   */
  getOrCreateSession(sessionId: string, dbml: string, data: Record<string, Record<string, unknown>[]>): string {
    const existing = this.sessions.get(sessionId);
    
    if (existing) {
      // Update session data if changed
      if (existing.dbml !== dbml || JSON.stringify(existing.data) !== JSON.stringify(data)) {
        this.updateSession(sessionId, dbml, data);
      } else {
        existing.lastAccessed = Date.now();
      }
      return sessionId;
    }

    // Create new session
    const newSessionId = sessionId || this.generateSessionId();
    this.createSession(newSessionId, dbml, data);
    return newSessionId;
  }

  /**
   * Create a new session
   */
  private createSession(sessionId: string, dbml: string, data: Record<string, Record<string, unknown>[]>): void {
    const dbPath = path.join(this.dbDir, `${sessionId}.db`);
    
    // Remove old database file if exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Create new database
    const db = new Database(dbPath);
    
    try {
      // Parse DBML and create schema
      const parsed = parseDBML(dbml);
      const schemaStatements = generateSQLSchema(parsed);

      // Execute CREATE TABLE statements
      for (const statement of schemaStatements) {
        db.exec(statement);
      }

      // Insert data
      for (const [tableName, rows] of Object.entries(data)) {
        if (rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        const stmt = db.prepare(insertSQL);
        const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
          for (const row of rows) {
            stmt.run(...columns.map(col => row[col]));
          }
        });

        insertMany(rows);
      }

      // Store session
      this.sessions.set(sessionId, {
        sessionId,
        dbml,
        data,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      });

      this.dbConnections.set(sessionId, db);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Update existing session
   */
  private updateSession(sessionId: string, dbml: string, data: Record<string, Record<string, unknown>[]>): void {
    // Close old connection
    const oldDb = this.dbConnections.get(sessionId);
    if (oldDb) {
      oldDb.close();
      this.dbConnections.delete(sessionId);
    }

    // Remove old database file
    const dbPath = path.join(this.dbDir, `${sessionId}.db`);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Create new session with updated data
    this.createSession(sessionId, dbml, data);
  }

  /**
   * Get database connection for session
   */
  getDatabase(sessionId: string): Database.Database | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last accessed time
    session.lastAccessed = Date.now();

    let db = this.dbConnections.get(sessionId);
    if (!db) {
      // Reopen database if connection was closed
      const dbPath = path.join(this.dbDir, `${sessionId}.db`);
      if (fs.existsSync(dbPath)) {
        db = new Database(dbPath);
        this.dbConnections.set(sessionId, db);
      }
    }

    return db || null;
  }

  /**
   * Execute query on session database
   */
  executeQuery(sessionId: string, query: string): { rows: unknown[]; columns: string[] } | null {
    const db = this.getDatabase(sessionId);
    if (!db) {
      return null;
    }

    try {
      const result = db.prepare(query).all();
      const columns = result.length > 0 ? Object.keys(result[0] as Record<string, unknown>) : [];

      return {
        rows: result,
        columns,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup old sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTimeout) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      this.deleteSession(sessionId);
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    // Close database connection
    const db = this.dbConnections.get(sessionId);
    if (db) {
      db.close();
      this.dbConnections.delete(sessionId);
    }

    // Remove database file
    const dbPath = path.join(this.dbDir, `${sessionId}.db`);
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.error(`Failed to delete database file for session ${sessionId}:`, error);
      }
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions count
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup all sessions (for testing/shutdown)
   */
  cleanupAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.deleteSession(sessionId);
    }
  }
}



