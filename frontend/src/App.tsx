import { useState, useEffect, useMemo } from "react"
import { executeQuery } from "@/services/api"
import { CodeEditor } from "@/components/CodeEditor"
import { parseDBML, mergeDataStructure } from "@/utils/dbmlParser"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChevronDown,
  Database,
  Download,
  Play,
  Table as TableIcon,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react"

function App() {
  const [dbmlCode, setDbmlCode] = useState(`// Use DBML to define your database structure
Table users {
  id integer [primary key]
  username varchar(50)
  role varchar(50)
  age integer [note: 'check: age > 0']
}

Table posts {
  id integer [primary key]
  title varchar(50)
  body text [note: 'Content of the post']
  user_id integer
  status varchar(50)
}

Ref: posts.user_id > users.id // many-to-one`)

  const [sqlQuery, setSqlQuery] = useState(`-- Get all users and related posts
SELECT *
FROM users u
JOIN posts p ON u.id = p.user_id;`)

  const [queryResult, setQueryResult] = useState<Record<string, unknown>[]>([])
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Parse DBML to get table structure
  const parsedTables = useMemo(() => parseDBML(dbmlCode), [dbmlCode])

  // Dynamic data structure based on DBML
  const [tableData, setTableData] = useState<Record<string, Record<string, unknown>[]>>({
    users: [
      { id: 1, username: "John", role: "admin", age: 20 },
      { id: 2, username: "Jane", role: "user", age: 30 },
    ],
    posts: [
      { id: 1, title: "Hello World", body: "This is my first post", user_id: 1, status: "published" },
      { id: 2, title: "Hello World", body: "This is my second post", user_id: 1, status: "published" },
      { id: 3, title: "Hello World", body: "This is my third post", user_id: 2, status: "published" },
    ],
  })

  const [editingRow, setEditingRow] = useState<{ table: string; index: number } | null>(null)

  // Update data structure when DBML changes
  useEffect(() => {
    setTableData((prevData) => mergeDataStructure(prevData, parsedTables))
  }, [dbmlCode, parsedTables])

  // Data management functions
  const handleAddRow = (tableName: string) => {
    const table = parsedTables.find((t) => t.name === tableName)
    if (!table) return

    const currentData = tableData[tableName] || []
    const newRow: Record<string, unknown> = {}
    
    // Create empty row based on table structure
    for (const col of table.columns) {
      if (col.type.toLowerCase().includes("int") || col.type.toLowerCase().includes("integer")) {
        newRow[col.name] = 0
      } else {
        newRow[col.name] = ""
      }
    }

    setTableData({
      ...tableData,
      [tableName]: [...currentData, newRow],
    })
    setEditingRow({ table: tableName, index: currentData.length })
  }

  const handleDeleteRow = (tableName: string, index: number) => {
    const currentData = tableData[tableName] || []
    setTableData({
      ...tableData,
      [tableName]: currentData.filter((_, i) => i !== index),
    })
    setEditingRow(null)
  }

  const handleUpdateRow = (tableName: string, index: number, field: string, value: unknown) => {
    const currentData = tableData[tableName] || []
    const updated = [...currentData]
    updated[index] = { ...updated[index], [field]: value }
    setTableData({
      ...tableData,
      [tableName]: updated,
    })
  }

  const handleRunQuery = async () => {
    setIsLoading(true)
    setQueryError(null)
    setExecutionTime(null)

    try {
      // Prepare data object from tableData
      const data = { ...tableData }

      const response = await executeQuery({
        sessionId: sessionId || undefined,
        dbml: dbmlCode,
        data,
        query: sqlQuery,
      })

      if (response.success && response.rows) {
        setQueryResult(response.rows)
        setExecutionTime(response.executionTime || null)
        setQueryError(null)
        // Save sessionId for reuse
        if (response.sessionId) {
          setSessionId(response.sessionId)
        }
      } else {
        setQueryError(response.error || "Query execution failed")
        setQueryResult([])
        setExecutionTime(response.executionTime || null)
      }
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Failed to execute query")
      setQueryResult([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">RunSQL</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
              Beta
            </span>
          </div>
          <Button variant="outline" size="sm">
            Example Run
          </Button>
          <Select defaultValue="postgresql">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Database" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgresql">PostgreSQL 16.6</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="sqlite">SQLite</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            Fork
            <span className="ml-2 text-xs text-gray-500">Ctrl-S</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Import
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Import from file</DropdownMenuItem>
              <DropdownMenuItem>Import from URL</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Help
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Documentation</DropdownMenuItem>
              <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
              <DropdownMenuItem>About</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Sign in
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4">
        {/* Left Column */}
        <div className="flex w-1/2 flex-col gap-4">
          {/* Define Database Structure Panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">
                  Define Database Structure
                </h2>
              </div>
              <span className="text-xs text-gray-500">Ctrl-Alt-1</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={dbmlCode}
                onChange={(value) => setDbmlCode(value || "")}
                language="dbml"
                height="100%"
              />
            </div>
          </div>

          {/* Define Data Panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Define Data</h2>
              </div>
              <span className="text-xs text-gray-500">Ctrl-Alt-2</span>
            </div>
            <div className="flex-1 overflow-auto">
              {parsedTables.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8">
                  <p className="text-gray-400 text-center">
                    No tables found. Define tables in DBML above.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue={parsedTables[0]?.name || ""} className="h-full">
                  <TabsList className="mx-4 mt-4">
                    {parsedTables.map((table) => (
                      <TabsTrigger key={table.name} value={table.name}>
                        {table.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {parsedTables.map((table) => {
                    const tableDataRows = tableData[table.name] || []
                    return (
                      <TabsContent key={table.name} value={table.name} className="m-4 mt-4">
                        <div className="overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {table.columns.map((col) => (
                                  <TableHead key={col.name}>{col.name}</TableHead>
                                ))}
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tableDataRows.map((row, index) => (
                                <TableRow key={index}>
                                  {table.columns.map((col) => (
                                    <TableCell key={col.name}>
                                      {editingRow?.table === table.name && editingRow.index === index ? (
                                        <input
                                          type={col.type.toLowerCase().includes("int") ? "number" : "text"}
                                          value={String(row[col.name] ?? "")}
                                          onChange={(e) => {
                                            const value = col.type.toLowerCase().includes("int")
                                              ? parseInt(e.target.value) || 0
                                              : e.target.value
                                            handleUpdateRow(table.name, index, col.name, value)
                                          }}
                                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                          autoFocus={col === table.columns[0]}
                                        />
                                      ) : (
                                        String(row[col.name] ?? "")
                                      )}
                                    </TableCell>
                                  ))}
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {editingRow?.table === table.name && editingRow.index === index ? (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingRow(null)}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Check className="h-4 w-4 text-green-600" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingRow(null)}
                                            className="h-8 w-8 p-0"
                                          >
                                            <X className="h-4 w-4 text-red-600" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingRow({ table: table.name, index })}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteRow(table.name, index)}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => handleAddRow(table.name)}
                        >
                          <span>+</span> New row
                        </Button>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex w-1/2 flex-col gap-4">
          {/* Write SQL Query Panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Write SQL Query</h2>
              </div>
              <span className="text-xs text-gray-500">Ctrl-Alt-3</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={sqlQuery}
                onChange={(value) => setSqlQuery(value || "")}
                language="sql"
                height="100%"
              />
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <Button
                onClick={handleRunQuery}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="mr-2 h-4 w-4" />
                {isLoading ? "Running..." : "Run"}
                <span className="ml-2 text-xs">Ctrl-↵</span>
              </Button>
              {queryError ? (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <span>✗</span> {queryError}
                </span>
              ) : executionTime !== null && queryResult.length > 0 ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <span>✔</span> {queryResult.length} row{queryResult.length !== 1 ? 's' : ''} returned. Executed in {executionTime.toFixed(2)} ms.
                </span>
              ) : executionTime !== null ? (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <span>ℹ</span> Query executed in {executionTime.toFixed(2)} ms. No rows returned.
                </span>
              ) : null}
            </div>
          </div>

          {/* Query Result Panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-gray-900">Query Result</h2>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {queryError ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-red-600 font-medium">Error executing query</p>
                    <p className="text-gray-500 text-sm mt-2">{queryError}</p>
                  </div>
                </div>
              ) : queryResult.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-gray-400">No results. Run a query to see results here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {queryResult.length > 0 &&
                        Object.keys(queryResult[0]).map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResult.map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.keys(row).map((col) => (
                          <TableCell key={col}>
                            {String(row[col] ?? 'NULL')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
  )
}

export default App
