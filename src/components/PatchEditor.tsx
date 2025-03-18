import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface PatchEditorProps {
  content: string;
}

export function PatchEditor({ content }: PatchEditorProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-0 left-0 h-full border-r border-[#404040] bg-[#252526] text-[#666] font-mono text-xs py-4 px-2">
          {content.split('\n').map((_, i) => (
            <div key={i} className="leading-6 text-right pr-2">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 pl-12 overflow-y-auto custom-scrollbar">
          <SyntaxHighlighter
            language="plaintext"
            style={materialDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              backgroundColor: '#1e1e1e',
              borderRadius: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              minHeight: '100%',
            }}
            showLineNumbers={false}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}