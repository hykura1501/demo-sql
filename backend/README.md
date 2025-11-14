# RunSQL Backend API

Backend API server for executing SQL queries with DBML schema definitions. Each request runs inside an isolated Docker sandbox to guarantee strong security boundaries.

## Features

- Parse DBML (Database Markup Language) and bootstrap the schema inside a disposable PostgreSQL container
- Seed sample data automatically before executing user queries
- Support persistent sessions per exam attempt (reuse the same container via `sessionId`)
- Allow arbitrary SQL (DDL/DML) while containing side effects within the sandbox
- Automatic TTL cleanup: containers are destroyed when sessions expire

## Tech Stack

- **Node.js** + **Express** - Web server
- **TypeScript** - Type safety
- **Docker** + **PostgreSQL** (wodby/postgres) - Isolated SQL execution sandboxes
- **dockerode** - Docker API client
- **pg** - PostgreSQL driver
- **CORS** - Cross-origin resource sharing

## Prerequisites

- Docker daemon running locally (the API uses Docker socket access)
- Node.js 18+

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Build

```bash
npm run build
npm start
```

## API Endpoints

### POST /api/execute-query

Execute SQL query with DBML schema and data.

**Request Body:**
```json
{
  "sessionId": "sandbox_1731500000000_abcd1234", // optional; reuse to keep the same container
  "engine": "postgres", // optional, defaults to postgres
  "dbml": "Table users { id integer [primary key] ... }",
  "data": {
    "users": [{ "id": 1, "username": "John" }],
    "posts": [{ "id": 1, "title": "Hello" }]
  },
  "query": "SELECT * FROM users"
}
```

**Response:**
```json
{
  "success": true,
  "rows": [...],
  "columns": ["id", "username"],
  "executionTime": 1.23,
  "sessionId": "sandbox_1731500000000_abcd1234",
  "engine": "postgres"
}
```

### GET /api/health

Health check endpoint.

## Project Structure

```
backend/
├── src/
│   ├── index.ts                     # Main server file
│   ├── routes/
│   │   └── queryRoutes.ts           # API routes
│   ├── services/
│   │   ├── containerSandboxManager.ts # Docker sandbox lifecycle manager
│   │   └── sqlExecutor.ts           # SQL execution orchestrator
│   └── parser/
│       └── dbmlParser.ts            # DBML parser
├── package.json
└── tsconfig.json
```

