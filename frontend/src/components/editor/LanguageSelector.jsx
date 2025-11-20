import React from 'react';
import { Code2, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', icon: '📜' },
  { id: 'typescript', name: 'TypeScript', icon: '📘' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'java', name: 'Java', icon: '☕' },
  { id: 'cpp', name: 'C++', icon: '⚡' },
  { id: 'c', name: 'C', icon: '🔧' },
  { id: 'csharp', name: 'C#', icon: '💎' },
  { id: 'go', name: 'Go', icon: '🐹' },
  { id: 'rust', name: 'Rust', icon: '🦀' },
  { id: 'php', name: 'PHP', icon: '🐘' },
  { id: 'ruby', name: 'Ruby', icon: '💎' },
  { id: 'html', name: 'HTML', icon: '🌐' },
  { id: 'css', name: 'CSS', icon: '🎨' },
  { id: 'json', name: 'JSON', icon: '📦' },
  { id: 'markdown', name: 'Markdown', icon: '📝' },
  { id: 'sql', name: 'SQL', icon: '🗄️' },
];

function LanguageSelector({ language, onLanguageChange }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const currentLanguage = LANGUAGES.find(lang => lang.id === language) || LANGUAGES[0];

  const handleSelect = (langId) => {
    onLanguageChange(langId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white text-sm"
      >
        <Code2 className="w-4 h-4" />
        <span>{currentLanguage.icon}</span>
        <span>{currentLanguage.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-2 w-48 max-h-64 overflow-y-auto">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleSelect(lang.id)}
                className={`w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                  lang.id === language ? 'bg-slate-700 text-purple-400' : 'text-white'
                }`}
              >
                <span>{lang.icon}</span>
                <span className="text-sm">{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default LanguageSelector;