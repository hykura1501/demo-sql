# RunSQL Backend API

Backend API server for executing SQL queries with DBML schema definitions.

## Features

- Parse DBML (Database Markup Language) to SQL schema
- Create in-memory SQLite database
- Insert data and execute SQL queries
- Return query results with execution time
- SQL injection protection (only SELECT queries allowed)

## Tech Stack

- **Node.js** + **Express** - Web server
- **TypeScript** - Type safety
- **better-sqlite3** - In-memory SQLite database
- **CORS** - Cross-origin resource sharing

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
  "executionTime": 1.23
}
```

### GET /api/health

Health check endpoint.

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main server file
│   ├── routes/
│   │   └── queryRoutes.ts    # API routes
│   ├── services/
│   │   └── sqlExecutor.ts    # SQL execution service
│   └── parser/
│       └── dbmlParser.ts     # DBML parser
├── package.json
└── tsconfig.json
```

