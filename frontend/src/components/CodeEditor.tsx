import { useRef } from "react"
import Editor from "@monaco-editor/react"
import type { Monaco } from "@monaco-editor/react"
import type * as monaco from "monaco-editor"

interface CodeEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  language: "sql" | "dbml"
  height?: string
}

export function CodeEditor({ value, onChange, language, height = "100%" }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorWillMount = (monaco: Monaco) => {
    // Register DBML language if not already registered
    if (!monaco.languages.getLanguages().find((lang) => lang.id === "dbml")) {
      monaco.languages.register({ id: "dbml" })

      // Set up DBML tokenization (similar to SQL but with DBML-specific keywords)
      monaco.languages.setMonarchTokensProvider("dbml", {
        tokenizer: {
          root: [
            [/\/\/.*$/, "comment"],
            [/\/\*[\s\S]*?\*\//, "comment"],
            [/\b(Table|Ref|enum|Project|TableGroup)\b/i, "keyword"],
            [/\b(primary key|note|default|increment|unique|not null|null)\b/i, "keyword"],
            [/\b(integer|varchar|text|real|boolean|date|datetime|timestamp)\b/i, "type"],
            [/"[^"]*"/, "string"],
            [/'[^']*'/, "string"],
            [/\d+/, "number"],
            [/[a-zA-Z_][a-zA-Z0-9_]*/, "identifier"],
            [/[{}]/, "delimiter"],
            [/[[\]]/, "delimiter"],
            [/[=<>!]+/, "operator"],
          ],
        },
      })

      // Set up DBML theme
      monaco.editor.defineTheme("dbml-theme", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "comment", foreground: "008000", fontStyle: "italic" },
          { token: "keyword", foreground: "0000FF", fontStyle: "bold" },
          { token: "type", foreground: "267F99" },
          { token: "string", foreground: "A31515" },
          { token: "number", foreground: "098658" },
          { token: "identifier", foreground: "001080" },
        ],
        colors: {},
      })
    }
  }

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
    })

    // Add keyboard shortcuts
    // Ctrl+/ or Cmd+/ for comment toggle
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction("editor.action.commentLine")?.run()
    })
  }

  return (
    <Editor
      height={height}
      language={language === "dbml" ? "dbml" : "sql"}
      value={value}
      onChange={onChange}
      beforeMount={handleEditorWillMount}
      onMount={handleEditorDidMount}
      theme={language === "dbml" ? "dbml-theme" : "vs"}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        formatOnType: true,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: "on",
        tabCompletion: "on",
        wordBasedSuggestions: "allDocuments",
      }}
    />
  )
}

