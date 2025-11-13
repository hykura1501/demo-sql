/**
 * DBML Parser - Converts DBML syntax to SQL CREATE TABLE statements
 */

export interface TableColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  constraints?: string[];
}

export interface Table {
  name: string;
  columns: TableColumn[];
}

export interface Relationship {
  from: string; // table.column
  to: string; // table.column
  type: string; // many-to-one, one-to-many, etc.
}

export interface ParsedDBML {
  tables: Table[];
  relationships: Relationship[];
}

/**
 * Parse DBML code and extract table definitions
 */
export function parseDBML(dbml: string): ParsedDBML {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];

  // Remove comments
  const cleaned = dbml.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Parse tables
  const tableRegex = /Table\s+(\w+)\s*\{([^}]+)\}/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(cleaned)) !== null) {
    const tableName = tableMatch[1];
    const tableBody = tableMatch[2];
    const columns: TableColumn[] = [];

    // Parse columns
    const columnLines = tableBody.split('\n').map(line => line.trim()).filter(line => line);
    
    for (const line of columnLines) {
      // Match: column_name type [constraints]
      const columnMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)\s*(?:\[([^\]]+)\])?/);
      if (columnMatch) {
        const [, name, type, constraintsStr] = columnMatch;
        const isPrimaryKey = constraintsStr?.includes('primary key') || false;
        const constraints: string[] = [];
        
        if (constraintsStr) {
          // Extract note, check, etc.
          const noteMatch = constraintsStr.match(/note:\s*['"]([^'"]+)['"]/);
          if (noteMatch) {
            constraints.push(`-- ${noteMatch[1]}`);
          }
        }

        columns.push({
          name,
          type: mapDBMLTypeToSQLite(type),
          isPrimaryKey,
          constraints: constraints.length > 0 ? constraints : undefined,
        });
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  // Parse relationships
  const refRegex = /Ref:\s*(\w+)\.(\w+)\s*>\s*(\w+)\.(\w+)\s*(?:\/\/\s*(.+))?/g;
  let refMatch;

  while ((refMatch = refRegex.exec(cleaned)) !== null) {
    relationships.push({
      from: `${refMatch[1]}.${refMatch[2]}`,
      to: `${refMatch[3]}.${refMatch[4]}`,
      type: refMatch[5]?.trim() || 'many-to-one',
    });
  }

  return { tables, relationships };
}

/**
 * Map DBML types to SQLite types
 */
function mapDBMLTypeToSQLite(dbmlType: string): string {
  const type = dbmlType.toLowerCase();
  
  if (type.includes('varchar') || type.includes('char')) {
    const match = type.match(/varchar\((\d+)\)/);
    return match ? `VARCHAR(${match[1]})` : 'TEXT';
  }
  
  if (type === 'text') return 'TEXT';
  if (type === 'integer' || type === 'int') return 'INTEGER';
  if (type === 'real' || type === 'float' || type === 'double') return 'REAL';
  if (type === 'boolean' || type === 'bool') return 'INTEGER'; // SQLite uses INTEGER for boolean
  if (type === 'date') return 'TEXT'; // SQLite uses TEXT for dates
  if (type === 'datetime' || type === 'timestamp') return 'TEXT';
  
  return 'TEXT'; // Default
}

/**
 * Generate SQL CREATE TABLE statements from parsed DBML
 */
export function generateSQLSchema(parsed: ParsedDBML): string[] {
  const statements: string[] = [];

  for (const table of parsed.tables) {
    const columns: string[] = [];
    
    for (const col of table.columns) {
      let colDef = `${col.name} ${col.type}`;
      if (col.isPrimaryKey) {
        colDef += ' PRIMARY KEY';
      }
      columns.push(colDef);
    }

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${columns.join(',\n  ')}\n);`;
    statements.push(createTableSQL);
  }

  return statements;
}

