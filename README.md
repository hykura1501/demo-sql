# RunSQL - SQL Database Management Tool

A web-based SQL query tool that allows you to define database schemas using DBML, insert data, and execute SQL queries in an in-memory database.

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
- **Location**: `frontend/`
- **Tech Stack**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Port**: 5173 (Vite default)

### Backend (Node.js + Express + TypeScript)
- **Location**: `backend/`
- **Tech Stack**: Express, TypeScript, better-sqlite3
- **Port**: 3001

## 🚀 Quick Start

### 1. Start Backend Server

```bash
cd backend
npm install
npm run dev
```

Backend will run on `http://localhost:3001`

### 2. Start Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend will run on `http://localhost:5173`

## 📋 Features

- ✅ Define database structure using DBML syntax
- ✅ Insert and manage data through UI
- ✅ Execute SQL queries (SELECT only for security)
- ✅ View query results in real-time
- ✅ See execution time for queries
- ✅ Error handling and validation

## 🔧 How It Works

1. **DBML Parsing**: Backend parses DBML code to extract table definitions
2. **Schema Creation**: Creates SQLite tables in-memory based on DBML
3. **Data Insertion**: Inserts data from frontend into tables
4. **Query Execution**: Executes SQL queries and returns results
5. **Result Display**: Frontend displays results in a table format

## 📡 API Endpoints

### POST /api/execute-query

Execute SQL query with DBML schema and data.

**Request:**
```json
{
  "dbml": "Table users { id integer [primary key] ... }",
  "data": {
    "users": [{ "id": 1, "username": "John" }]
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

## 🛡️ Security

- Only SELECT queries are allowed (no DROP, DELETE, UPDATE, etc.)
- SQL injection protection through query validation
- In-memory database (isolated per request)

## 📁 Project Structure

```
demo/
├── frontend/          # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── services/
│   │   └── components/
│   └── package.json
├── backend/           # Express backend
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── services/
│   │   └── parser/
│   └── package.json
└── README.md
```

## 🎯 Next Steps

- [ ] Add support for more SQL operations
- [ ] Add database export functionality
- [ ] Improve DBML parser (support more features)
- [ ] Add query history
- [ ] Add syntax highlighting for SQL/DBML

