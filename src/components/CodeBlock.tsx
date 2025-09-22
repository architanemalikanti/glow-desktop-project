import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import './CodeBlock.css';

interface CodeBlockProps {
  children: string;
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className }) => {
  const [copied, setCopied] = useState(false);
  
  // Extract language from className (e.g., "language-python" -> "python")
  const language = className?.replace('language-', '') || 'text';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Basic syntax highlighting function
  const highlightCode = (code: string, lang: string) => {
    if (lang === 'text' || !lang) return escapeHtml(code);

    // First escape HTML to prevent XSS
    let highlighted = escapeHtml(code);

    // Define patterns for different languages
    const patterns: { [key: string]: Array<{ regex: RegExp; className: string }> } = {
      java: [
        { regex: /\b(public|private|protected|static|final|class|interface|extends|implements|void|int|String|boolean|double|float|long|char|byte|short|for|while|if|else|try|catch|finally|throw|throws|return|new|this|super|import|package)\b/g, className: 'keyword' },
        { regex: /"[^"]*"/g, className: 'string' },
        { regex: /'[^']*'/g, className: 'string' },
        { regex: /\/\/.*$/gm, className: 'comment' },
        { regex: /\/\*[\s\S]*?\*\//g, className: 'comment' },
        { regex: /\b\d+\.?\d*\b/g, className: 'number' },
        { regex: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'type' },
      ],
      javascript: [
        { regex: /\b(function|var|let|const|if|else|for|while|return|class|extends|import|export|from|default|async|await|try|catch|finally|throw|new|this|typeof|instanceof)\b/g, className: 'keyword' },
        { regex: /"[^"]*"/g, className: 'string' },
        { regex: /'[^']*'/g, className: 'string' },
        { regex: /`[^`]*`/g, className: 'string' },
        { regex: /\/\/.*$/gm, className: 'comment' },
        { regex: /\/\*[\s\S]*?\*\//g, className: 'comment' },
        { regex: /\b\d+\.?\d*\b/g, className: 'number' },
        { regex: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'type' },
      ],
      python: [
        { regex: /\b(def|class|if|elif|else|for|while|try|except|finally|import|from|as|return|yield|lambda|with|assert|break|continue|pass|global|nonlocal|True|False|None)\b/g, className: 'keyword' },
        { regex: /"[^"]*"/g, className: 'string' },
        { regex: /'[^']*'/g, className: 'string' },
        { regex: /"""[\s\S]*?"""/g, className: 'string' },
        { regex: /#.*$/gm, className: 'comment' },
        { regex: /\b\d+\.?\d*\b/g, className: 'number' },
        { regex: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'type' },
      ],
      html: [
        { regex: /&lt;[^&gt;]*&gt;/g, className: 'keyword' },
        { regex: /"[^"]*"/g, className: 'string' },
        { regex: /'[^']*'/g, className: 'string' },
      ],
      css: [
        { regex: /\b(color|background|margin|padding|border|width|height|display|position|float|clear|font|text|line|letter|word|white|vertical|horizontal)\b/g, className: 'keyword' },
        { regex: /"[^"]*"/g, className: 'string' },
        { regex: /'[^']*'/g, className: 'string' },
        { regex: /\/\*[\s\S]*?\*\//g, className: 'comment' },
      ]
    };

    const langPatterns = patterns[lang] || patterns.java;
    
    // Apply highlighting patterns in order (comments first to avoid conflicts)
    const orderedPatterns = [
      ...langPatterns.filter(p => p.className === 'comment'),
      ...langPatterns.filter(p => p.className === 'string'),
      ...langPatterns.filter(p => p.className === 'keyword'),
      ...langPatterns.filter(p => p.className === 'number'),
      ...langPatterns.filter(p => p.className === 'type'),
    ];
    
    orderedPatterns.forEach(({ regex, className }) => {
      highlighted = highlighted.replace(regex, (match) => `<span class="syntax-${className}">${match}</span>`);
    });

    return highlighted;
  };

  // Helper function to escape HTML
  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-language">{language}</span>
        <button 
          className="copy-code-btn"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span className="copy-text">
            {copied ? 'Copied!' : 'Copy code'}
          </span>
        </button>
      </div>
      <div className="code-block-content">
        <pre className="code-pre">
          <code 
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlightCode(children, language) }}
          />
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
