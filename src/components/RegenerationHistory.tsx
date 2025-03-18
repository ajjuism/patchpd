import { AlertCircle, Clock, RefreshCw, CheckCircle, Code, MessageSquare, ArrowRight } from 'lucide-react';
import type { PdPatch } from '../types';

interface RegenerationHistoryProps {
  patch: PdPatch;
  onViewCode?: (content: string) => void;
}

export function RegenerationHistory({ patch, onViewCode }: RegenerationHistoryProps) {
  return (
    <div className="space-y-4">
      {patch.errorHistory?.map((history, index) => (
        <div key={index} className="bg-gradient-to-b from-[#2d2d2d] to-[#262626] rounded-lg border border-[#404040] overflow-hidden">
          {/* Error Header */}
          <div className="px-4 py-3 flex items-start gap-3 bg-[#2d2d2d]">
            <div className="rounded-full bg-orange-500/10 p-1.5 mt-0.5">
              <AlertCircle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-orange-200">
                  Generation Error #{patch.errorHistory.length - index}
                </div>
                <time className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {new Date(history.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </time>
              </div>
            </div>
          </div>

          {/* Error Details */}
          <div className="px-4 py-3 border-t border-[#404040]/50">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
              <pre className="flex-1 text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
                {history.error}
              </pre>
            </div>
          </div>

          {/* Regeneration Status */}
          {history.regeneratedPatch && (
            <div className="px-4 py-3 border-t border-[#404040]/50 bg-emerald-500/5">
              <div className="flex items-center gap-2 text-emerald-400/90 mb-2">
                <div className="rounded-full bg-emerald-500/10 p-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium">Successfully Regenerated</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <time className="text-xs text-gray-500 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" />
                    {new Date(history.regeneratedPatch.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                </div>

                <button
                  onClick={() => onViewCode?.(history.regeneratedPatch.content)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md 
                           bg-emerald-500/10 hover:bg-emerald-500/20 
                           transition-colors text-xs text-emerald-400"
                >
                  <Code className="w-3 h-3" />
                  View Changes
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {history.regeneratedPatch.explanation && (
                <div className="mt-2 text-xs text-gray-400 bg-black/20 rounded-md p-2">
                  {history.regeneratedPatch.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {!patch.errorHistory?.length && (
        <div className="text-center py-6 text-gray-500">
          <div className="rounded-full bg-gray-500/10 p-3 w-fit mx-auto mb-3">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-sm">No errors encountered during generation</p>
        </div>
      )}
    </div>
  );
} 