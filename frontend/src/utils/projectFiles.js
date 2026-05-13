/** Multi-file project helpers (flat paths, same-folder imports). */

export function pathToMonacoLanguage(path) {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  const map = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.json': 'json',
    '.md': 'markdown',
    '.sql': 'sql',
  };
  return map[ext] || 'plaintext';
}

export function pathToRuntimeLanguage(path) {
  return pathToMonacoLanguage(path) === 'plaintext' ? 'javascript' : pathToMonacoLanguage(path);
}

const LANG_MAIN = {
  javascript: 'main.js',
  typescript: 'main.ts',
  python: 'main.py',
  java: 'Main.java',
  cpp: 'main.cpp',
  c: 'main.c',
  csharp: 'Program.cs',
  go: 'main.go',
  rust: 'main.rs',
  php: 'main.php',
  ruby: 'main.rb',
  html: 'index.html',
  css: 'styles.css',
  json: 'data.json',
  markdown: 'README.md',
  sql: 'query.sql',
};

export function defaultMainPath(language) {
  return LANG_MAIN[language] || 'main.txt';
}

const WELCOME = {
  javascript:
    '// Welcome! Use + to add files. Example:\n// import { x } from "./utils.js";\n\n',
  typescript:
    '// Welcome! Use + to add files. Example:\n// import { x } from "./utils";\n\n',
  python:
    '# Welcome! Use + to add files.\n# from utils import hello\n\n',
  java: '// Welcome! Add more .java files and use packages as needed.\n\n',
  cpp: '// Welcome! Use + to add headers/sources.\n\n',
  c: '/* Welcome! */\n\n',
  csharp: '// Welcome!\n\n',
  go: 'package main\n\n// Welcome!\n',
  rust: '// Welcome!\n\nfn main() {}\n',
  php: "<?php\n// Welcome!\n",
  ruby: '# Welcome!\n',
  html: '<!DOCTYPE html>\n<html>\n<body>\n</body>\n</html>\n',
  css: '/* Welcome! */\n',
  json: '{}\n',
  markdown: '# Welcome\n',
  sql: '-- Welcome\n',
};

export function welcomeForLanguage(language) {
  return WELCOME[language] || '// Welcome to the collaborative editor!\n';
}

export function sanitizeFilePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.includes('..')) return '';
  if (!/^[a-zA-Z0-9._\-/]+$/.test(trimmed)) return '';
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..')) return '';
  return parts.join('/');
}

export function uniquePath(base, existingPaths) {
  const set = new Set(existingPaths);
  if (!set.has(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (set.has(candidate)) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}

export function normalizeFilesPayload(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((f) => {
      const raw = typeof f?.path === 'string' ? f.path : '';
      const path = sanitizeFilePath(raw);
      if (!path) return null;
      return {
        path,
        content: typeof f?.content === 'string' ? f.content : '',
      };
    })
    .filter(Boolean);
}
