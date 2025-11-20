import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

function CodeEditor({ 
  code, 
  language, 
  onChange, 
  readOnly = false 
}) {
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Set editor options
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      readOnly: readOnly,
    });

    // Focus the editor
    editor.focus();
  };

  const handleEditorChange = (value) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          readOnly: readOnly,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
          },
          overviewRulerLanes: 0,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-slate-900">
            <div className="text-purple-400 text-lg">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}

export default CodeEditor;