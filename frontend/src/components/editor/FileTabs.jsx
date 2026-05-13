import React from 'react';
import { Plus, FileCode, Trash2 } from 'lucide-react';

function FileTabs({ files, activePath, onSelect, onAdd, onDelete }) {
  return (
    <div className="flex items-center gap-1 bg-slate-900 border-b border-slate-700 px-2 py-1 min-h-[40px] overflow-x-auto shrink-0">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {files.map((f) => {
          const active = f.path === activePath;
          return (
            <div
              key={f.path}
              className={`group flex items-center rounded-md shrink-0 ${
                active ? 'bg-slate-700' : 'bg-slate-800/80 hover:bg-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(f.path)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium truncate max-w-[180px] ${
                  active ? 'text-white' : 'text-slate-300'
                }`}
                title={f.path}
              >
                <FileCode
                  className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-purple-400' : 'text-slate-500'}`}
                />
                <span className="truncate font-mono text-xs">{f.path}</span>
              </button>
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(f.path);
                  }}
                  className="pr-2 py-1.5 text-slate-500 hover:text-red-400 opacity-70 hover:opacity-100"
                  title="Remove file"
                  aria-label={`Remove ${f.path}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm shrink-0 border border-slate-600"
        title="Add file"
      >
        <Plus className="w-4 h-4 text-purple-400" />
        <span className="hidden sm:inline text-xs font-medium">Add file</span>
      </button>
    </div>
  );
}

export default FileTabs;
