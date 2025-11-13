/**
 * Simple DBML parser for frontend
 * Extracts table names and columns from DBML code
 */

export interface TableColumn {
  name: string
  type: string
}

export interface ParsedTable {
  name: string
  columns: TableColumn[]
}

export function parseDBML(dbml: string): ParsedTable[] {
  const tables: ParsedTable[] = []

  // Remove comments
  const cleaned = dbml.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")

  // Parse tables
  const tableRegex = /Table\s+(\w+)\s*\{([^}]+)\}/g
  let tableMatch

  while ((tableMatch = tableRegex.exec(cleaned)) !== null) {
    const tableName = tableMatch[1]
    const tableBody = tableMatch[2]
    const columns: TableColumn[] = []

    // Parse columns
    const columnLines = tableBody.split("\n").map((line) => line.trim()).filter((line) => line)

    for (const line of columnLines) {
      // Match: column_name type [constraints]
      const columnMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/)
      if (columnMatch) {
        const [, name, type] = columnMatch
        columns.push({ name, type })
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns })
    }
  }

  return tables
}

/**
 * Create empty data structure based on parsed tables
 */
export function createEmptyDataStructure(tables: ParsedTable[]): Record<string, Record<string, unknown>[]> {
  const data: Record<string, Record<string, unknown>[]> = {}

  for (const table of tables) {
    const emptyRow: Record<string, unknown> = {}
    for (const col of table.columns) {
      // Set default values based on type
      if (col.type.toLowerCase().includes("int") || col.type.toLowerCase().includes("integer")) {
        emptyRow[col.name] = 0
      } else {
        emptyRow[col.name] = ""
      }
    }
    data[table.name] = []
  }

  return data
}

/**
 * Merge existing data with new structure, preserving existing values
 */
export function mergeDataStructure(
  existingData: Record<string, Record<string, unknown>[]>,
  newTables: ParsedTable[]
): Record<string, Record<string, unknown>[]> {
  const merged: Record<string, Record<string, unknown>[]> = {}

  for (const table of newTables) {
    if (existingData[table.name] && existingData[table.name].length > 0) {
      // Preserve existing data, but update structure
      const existingRows = existingData[table.name]
      merged[table.name] = existingRows.map((row) => {
        const newRow: Record<string, unknown> = {}
        for (const col of table.columns) {
          // Keep existing value if column exists, otherwise use default
          if (row[col.name] !== undefined) {
            newRow[col.name] = row[col.name]
          } else {
            newRow[col.name] = col.type.toLowerCase().includes("int") ? 0 : ""
          }
        }
        return newRow
      })
    } else {
      // New table, create empty array
      merged[table.name] = []
    }
  }

  return merged
}

