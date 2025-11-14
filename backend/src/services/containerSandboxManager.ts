import Docker, { Container } from 'dockerode';
import { Client, FieldDef } from 'pg';
import * as net from 'net';
import { Readable } from 'stream';
import { parseDBML, generateSQLSchema } from '../parser/dbmlParser';

export type SupportedEngine = 'postgres';

export interface SandboxConfig {
  image: string;
  username: string;
  password: string;
  database: string;
  ttlMs: number;
  readinessTimeoutMs: number;
  readinessRetryDelayMs: number;
  cleanupIntervalMs: number;
}

export interface SandboxRequest {
  sessionId?: string;
  dbml: string;
  data: Record<string, Record<string, unknown>[]>;
  engine?: SupportedEngine;
}

interface SandboxInstance {
  sessionId: string;
  dbml: string;
  dataHash: string;
  engine: SupportedEngine;
  containerId: string;
  hostPort: number;
  createdAt: number;
  lastAccessed: number;
}

interface QueryResult {
  rows: unknown[];
  columns: string[];
}

export class ContainerSandboxManager {
  private docker: Docker;
  private sandboxes: Map<string, SandboxInstance> = new Map();
  private ensureImagePromise: Promise<void> | null = null;
  private cleanupTimer: NodeJS.Timeout;
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.docker = new Docker();
    this.config = {
      image: 'wodby/postgres:15',
      username: 'sandbox',
      password: 'sandbox',
      database: 'sandbox',
      ttlMs: 60 * 60 * 1000, // 1 hour default
      readinessTimeoutMs: 60 * 1000, // 60s
      readinessRetryDelayMs: 2000, // 2s
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSandboxes();
    }, this.config.cleanupIntervalMs).unref();
  }

  async getOrCreateSandbox(request: SandboxRequest): Promise<SandboxInstance> {
    const engine: SupportedEngine = request.engine ?? 'postgres';
    const normalizedSessionId =
      request.sessionId && this.sandboxes.has(request.sessionId)
        ? request.sessionId
        : this.generateSessionId();

    const existing = this.sandboxes.get(normalizedSessionId);
    const dataHash = this.computeDataHash(request.dbml, request.data);

    if (existing) {
      if (existing.dbml !== request.dbml || existing.dataHash !== dataHash) {
        return await this.replaceSandbox(existing.sessionId, request.dbml, request.data, engine, dataHash);
      } else {
        existing.lastAccessed = Date.now();
        return existing;
      }
    }

    return await this.createSandbox(normalizedSessionId, request.dbml, request.data, engine, dataHash);
  }

  async executeQuery(sessionId: string, query: string): Promise<QueryResult> {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox session not found or expired');
    }

    sandbox.lastAccessed = Date.now();

    switch (sandbox.engine) {
      case 'postgres':
        return await this.executePostgresQuery(sandbox.hostPort, query);
      default:
        throw new Error(`Unsupported engine: ${sandbox.engine}`);
    }
  }

  async deleteSandbox(sessionId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return;

    await this.removeContainer(sandbox.containerId);
    this.sandboxes.delete(sessionId);
  }

  getActiveSandboxesCount(): number {
    return this.sandboxes.size;
  }

  async cleanupAll(): Promise<void> {
    const deletions = Array.from(this.sandboxes.keys()).map(sessionId => this.deleteSandbox(sessionId));
    await Promise.allSettled(deletions);
  }

  private async replaceSandbox(
    sessionId: string,
    dbml: string,
    data: Record<string, Record<string, unknown>[]>,
    engine: SupportedEngine,
    dataHash: string
  ): Promise<SandboxInstance> {
    await this.deleteSandbox(sessionId);
    return await this.createSandbox(sessionId, dbml, data, engine, dataHash);
  }

  private async createSandbox(
    sessionId: string,
    dbml: string,
    data: Record<string, Record<string, unknown>[]>,
    engine: SupportedEngine,
    dataHash: string
  ): Promise<SandboxInstance> {
    if (engine !== 'postgres') {
      throw new Error(`Engine ${engine} is not supported yet`);
    }

    await this.ensureImage(engine);
    const hostPort = await this.allocatePort();
    const container = await this.launchPostgresContainer(sessionId, hostPort);

    try {
      await this.waitForPostgresReady(hostPort);
      await this.seedPostgresDatabase(hostPort, dbml, data);
    } catch (error) {
      await this.safeRemoveContainer(container);
      throw error;
    }

    const sandbox: SandboxInstance = {
      sessionId,
      dbml,
      dataHash,
      engine,
      containerId: container.id,
      hostPort,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    this.sandboxes.set(sessionId, sandbox);
    return sandbox;
  }

  private async ensureImage(engine: SupportedEngine): Promise<void> {
    if (engine !== 'postgres') return;
    if (this.ensureImagePromise) {
      await this.ensureImagePromise;
      return;
    }

    this.ensureImagePromise = (async () => {
      const images = await this.docker.listImages({
        filters: { reference: [this.config.image] },
      });

      if (images.length === 0) {
        await new Promise<void>((resolve, reject) => {
          this.docker.pull(this.config.image, (err: Error | null, stream?: Readable) => {
            if (err) {
              reject(err);
              return;
            }
            if (!stream) {
              reject(new Error('Docker pull returned empty stream'));
              return;
            }
            this.docker.modem.followProgress(
              stream,
              (pullErr: Error | null) => {
                if (pullErr) {
                  reject(pullErr);
                } else {
                  resolve();
                }
              },
              () => {
                // progress handler unused
              }
            );
          });
        });
      }
    })();

    try {
      await this.ensureImagePromise;
    } finally {
      this.ensureImagePromise = null;
    }
  }

  private async launchPostgresContainer(sessionId: string, hostPort: number): Promise<Container> {
    const containerName = `sql-sandbox-${sessionId}`;
    const container = await this.docker.createContainer({
      Image: this.config.image,
      name: containerName,
      Env: [
        `POSTGRES_USER=${this.config.username}`,
        `POSTGRES_PASSWORD=${this.config.password}`,
        `POSTGRES_DB=${this.config.database}`,
      ],
      ExposedPorts: {
        '5432/tcp': {},
      },
      HostConfig: {
        AutoRemove: false,
        PortBindings: {
          '5432/tcp': [
            {
              HostPort: hostPort.toString(),
            },
          ],
        },
      },
    });

    await container.start();
    return container;
  }

  private async waitForPostgresReady(hostPort: number): Promise<void> {
    const start = Date.now();
    let lastError: unknown = null;

    while (Date.now() - start < this.config.readinessTimeoutMs) {
      try {
        const client = new Client({
          host: '127.0.0.1',
          port: hostPort,
          user: this.config.username,
          password: this.config.password,
          database: this.config.database,
        });

        await client.connect();
        await client.end();
        return;
      } catch (error) {
        lastError = error;
        await this.delay(this.config.readinessRetryDelayMs);
      }
    }

    throw new Error(
      `Postgres sandbox failed to become ready within ${this.config.readinessTimeoutMs}ms: ${String(lastError)}`
    );
  }

  private async seedPostgresDatabase(
    hostPort: number,
    dbml: string,
    data: Record<string, Record<string, unknown>[]>
  ): Promise<void> {
    const parsed = parseDBML(dbml);
    const schemaStatements = generateSQLSchema(parsed);
    const client = new Client({
      host: '127.0.0.1',
      port: hostPort,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    });

    await client.connect();

    try {
      for (const statement of schemaStatements) {
        await client.query(statement);
      }

      for (const [tableName, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        if (columns.length === 0) continue;

        const quotedColumns = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const insertSQL = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          await client.query(insertSQL, values);
        }
      }
    } finally {
      await client.end();
    }
  }

  private async executePostgresQuery(hostPort: number, query: string): Promise<QueryResult> {
    const client = new Client({
      host: '127.0.0.1',
      port: hostPort,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
    });

    await client.connect();

    try {
      const result = await client.query(query);
      const columns = result.fields ? result.fields.map((field: FieldDef) => field.name) : [];
      return {
        rows: result.rows,
        columns,
      };
    } finally {
      await client.end();
    }
  }

  private async cleanupExpiredSandboxes(): Promise<void> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, sandbox] of this.sandboxes.entries()) {
      if (now - sandbox.lastAccessed > this.config.ttlMs) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      await this.deleteSandbox(sessionId);
    }
  }

  private async removeContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 5 }).catch(() => undefined);
      await container.remove({ force: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to remove container ${containerId}:`, error);
    }
  }

  private async safeRemoveContainer(container: Container): Promise<void> {
    try {
      await container.stop({ t: 5 }).catch(() => undefined);
      await container.remove({ force: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to cleanup sandbox container ${container.id}:`, error);
    }
  }

  private async allocatePort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          const port = address.port;
          server.close(err => {
            if (err) reject(err);
            else resolve(port);
          });
        } else {
          reject(new Error('Failed to allocate port'));
        }
      });
    });
  }

  private generateSessionId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private computeDataHash(dbml: string, data: Record<string, Record<string, unknown>[]>): string {
    const normalized = {
      dbml,
      data,
    };
    return JSON.stringify(normalized);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


