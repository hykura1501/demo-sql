# RunSQL - SQL Database Management Tool

A web-based SQL query tool that allows you to define database schemas using DBML, seed data, and execute SQL queries inside disposable Docker sandboxes.

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
- **Location**: `frontend/`
- **Tech Stack**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Port**: 5173 (Vite default)

### Backend (Node.js + Express + TypeScript)
- **Location**: `backend/`
- **Tech Stack**: Express, TypeScript, Docker (wodby/postgres), dockerode, pg
- **Port**: 3001
- **Prerequisites**: Docker daemon running locally

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
- ✅ Execute SQL queries (full DDL/DML supported inside sandbox)
- ✅ View query results in real-time
- ✅ See execution time for queries
- ✅ Error handling and validation

## 🔧 How It Works

1. **DBML Parsing**: Backend parses DBML code to extract table definitions
2. **Sandbox Provisioning**: Backend creates (or reuses) a PostgreSQL container per session
3. **Schema Creation & Data Seeding**: DBML-generated SQL and sample data are applied inside the container
4. **Query Execution**: Arbitrary SQL runs inside the sandbox and returns results
5. **Result Display**: Frontend displays results in a table format

## 📡 API Endpoints

### POST /api/execute-query

Execute SQL query with DBML schema and data.

**Request:**
```json
{
  "sessionId": "sandbox_1731500000000_abcd1234",
  "engine": "postgres",
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
  "executionTime": 1.23,
  "sessionId": "sandbox_1731500000000_abcd1234",
  "engine": "postgres"
}
```

## 🛡️ Security

- Mỗi session chạy trong container PostgreSQL riêng biệt
- Container bị destroy khi hết hạn TTL hoặc bị xoá thủ công
- DB credentials sandbox (`sandbox`/`sandbox`) không lộ ra ngoài
- Tương lai: hạn chế tài nguyên (CPU/memory) cho từng container qua Docker/Kubernetes

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

- [ ] Bổ sung tuỳ chọn engine khác (MySQL, SQL Server) với sandbox tương ứng
- [ ] Tích hợp job queue để thực thi truy vấn bất đồng bộ khi tải cao
- [ ] Cải thiện DBML parser (mapping type đa engine, constraint nâng cao)
- [ ] Thêm query history & audit trail
- [ ] Giới hạn resource/quyền thông qua seccomp/AppArmor profiles

