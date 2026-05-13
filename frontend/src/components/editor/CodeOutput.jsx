import React, { useState } from 'react';
import { Play, Terminal, AlertCircle, CheckCircle, Clock, Loader } from 'lucide-react';
import { pathToRuntimeLanguage } from '../../utils/projectFiles';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function CodeOutput({ files, entryPath }) {
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);

  const entry = files?.find((f) => f.path === entryPath) || files?.[0];
  const code = entry?.content ?? '';
  const language = pathToRuntimeLanguage(entry?.path || entryPath || '');

  const executeCode = async () => {
    if (!files?.length) {
      setError('No files in project.');
      return;
    }
    if (!code?.trim()) {
      setError('The active file is empty.');
      return;
    }

    setLoading(true);
    setError(null);
    setOutput(null);
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_URL}/api/execute-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files,
          entryPath: entry?.path || entryPath,
          language,
        }),
      });

      const data = await response.json();
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);

      if (!response.ok) {
        throw new Error(data.message || 'Execution failed');
      }

      setOutput(data);
      console.log('Execution result:', data);

    } catch (err) {
      console.error('Execution error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearOutput = () => {
    setOutput(null);
    setError(null);
    setExecutionTime(0);
  };

  const hasOutput = output && (output.stdout || output.stderr || output.output);
  const isSuccess = output && output.exitCode === 0 && !output.stderr;

  return (
    <div className="bg-slate-800 border-t border-slate-700 flex flex-col max-h-80">
      
      {/* Header with Controls */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between bg-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="text-white font-medium text-sm">Output</span>
          {output && (
            <div className="flex items-center gap-2 ml-2">
              {isSuccess ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-xs text-slate-400">
                <Clock className="w-3 h-3 inline mr-1" />
                {executionTime}ms
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {(output || error) && (
            <button
              onClick={clearOutput}
              className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={executeCode}
            disabled={loading}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2 text-sm font-medium"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output Display */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-900 font-mono text-sm">
        
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Executing code...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-700/50 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-semibold">Error</span>
            </div>
            <pre className="text-red-300 whitespace-pre-wrap break-words text-xs">
              {error}
            </pre>
          </div>
        )}

        {/* Success Output */}
        {output && !loading && (
          <div className="space-y-3">
            
            {/* Standard Output */}
            {output.stdout && (
              <div>
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  Standard Output:
                </div>
                <pre className="text-green-300 whitespace-pre-wrap break-words bg-slate-800 p-3 rounded border border-slate-700">
{output.stdout}
                </pre>
              </div>
            )}

            {/* Standard Error */}
            {output.stderr && (
              <div>
                <div className="text-xs text-red-400 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Error Output:
                </div>
                <pre className="text-red-300 whitespace-pre-wrap break-words bg-red-900/10 p-3 rounded border border-red-700/50">
{output.stderr}
                </pre>
              </div>
            )}

            {/* Combined Output */}
            {output.output && !output.stdout && !output.stderr && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Output:</div>
                <pre className="text-slate-300 whitespace-pre-wrap break-words bg-slate-800 p-3 rounded border border-slate-700">
{output.output}
                </pre>
              </div>
            )}

            {/* Execution Info */}
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
              <span>Exit Code: <span className={output.exitCode === 0 ? 'text-green-400' : 'text-red-400'}>{output.exitCode}</span></span>
              <span>Language: <span className="text-purple-400">{output.language}</span></span>
              <span>Version: <span className="text-blue-400">{output.version}</span></span>
            </div>

            {/* No Output Message */}
            {!hasOutput && output.exitCode === 0 && (
              <div className="text-slate-500 text-center py-8">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>Code executed successfully with no output</p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!output && !loading && !error && (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No output yet</p>
              <p className="text-xs text-slate-600">Click "Run Code" to execute</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeOutput;