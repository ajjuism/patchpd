import { useState, useMemo } from 'react';
import { Terminal, Loader2, Download, Play, FileCode2, Info, Settings, ChevronRight, Folder, History, Clock, Search, Command, X, RefreshCw, AlertCircle, HelpCircle, File as FileIcon, Package, CheckCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { generatePdPatch } from './lib/openai';
import { PatchEditor } from './components/PatchEditor';
import type { PdPatch } from './types';

// Add this type above the App function
type Tab = 'explorer' | 'history' | 'settings';

// Add this utility function at the top of the file
const truncateText = (text: string, maxLength: number = 50) => {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<PdPatch | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [history, setHistory] = useState<PdPatch[]>(() => {
    const savedHistory = localStorage.getItem('pdPatchHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdErrors, setPdErrors] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('explorer');
  const [showSearch, setShowSearch] = useState(false);

  // Add this function to filter history items
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    return history.filter(patch => 
      patch.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patch.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [history, searchQuery]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setPdErrors('');

    try {
      const result = await generatePdPatch(prompt);
      
      const newPatch: PdPatch = {
        name: `patch_${Date.now()}`,
        content: result.patch,
        explanation: result.explanation,
        description: prompt,
        created: new Date(),
        version: '1.0',
        metadata: {
          width: 520,
          height: 400,
          audioEnabled: true,
          controlRate: true,
          requiredObjects: [
            'loadbang',
            'tgl',
            'metro',
            'osc~',
            'dac~',
            '*~',
            'clip~',
            'vu',
            'cnv'
          ],
          audioChain: {
            hasStartToggle: true,
            hasDac: true,
            hasVolumeControl: true,
            hasVuMeter: true,
            hasInstructions: true,
          },
        },
        errorHistory: [],
      };

      // Verify patch has basic audio functionality
      const audioValidation = {
        hasAudioSource: result.patch.includes('osc~') || result.patch.includes('phasor~') || result.patch.includes('noise~'),
        hasVolume: result.patch.includes('*~ 0.5') || result.patch.includes('*~ 0.25'),
        hasOutput: result.patch.includes('dac~'),
        hasConnections: (result.patch.match(/#X connect/g) || []).length >= 6,
      };

      if (!Object.values(audioValidation).every(v => v)) {
        throw new Error('Generated patch is missing critical audio components');
      }

      setCurrentPatch(newPatch);
      setHistory(prev => {
        const updated = [newPatch, ...prev];
        localStorage.setItem('pdPatchHistory', JSON.stringify(updated));
        return updated;
      });
      toast.success('Patch generated successfully!');
    } catch (error: any) {
      if (error.message.includes('API key')) {
        toast.error(error.message, {
          duration: 5000,
          icon: '🔑',
          action: {
            label: 'Set API Key',
            onClick: () => setShowApiSettings(true),
          },
        });
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!currentPatch) return;
    
    const blob = new Blob([currentPatch.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPatch.name}.pd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Patch downloaded successfully!');
  };

  const handleRegenerate = async (errorMessage: string) => {
    if (!currentPatch) return;

    setIsRegenerating(true);
    setPdErrors('');

    try {
      const result = await generatePdPatch(currentPatch.description, errorMessage);
      
      // Update the current patch with the regenerated version and error history
      const updatedPatch: PdPatch = {
        ...currentPatch,
        errorHistory: [
          {
            error: errorMessage,
            timestamp: new Date(),
            regeneratedPatch: {
              content: result.patch,
              explanation: result.explanation,
            timestamp: new Date()
            }
          },
          ...(currentPatch.errorHistory || [])
        ]
      };

      setCurrentPatch(updatedPatch);
      
      // Update history
      setHistory(prev => {
        const updated = prev.map(p => 
          p.name === currentPatch.name ? updatedPatch : p
        );
        localStorage.setItem('pdPatchHistory', JSON.stringify(updated));
        return updated;
      });

    } catch (error) {
      toast.error('Failed to regenerate patch');
      console.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'Enter':
          handleGenerate();
          break;
        case 's':
          e.preventDefault();
          if (currentPatch) handleDownload();
          break;
        case 'e':
          e.preventDefault();
          if (currentPatch) setShowExplanation(!showExplanation);
          break;
        case 'h':
          e.preventDefault();
          setShowHistory(!showHistory);
          break;
      }
    }
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeyError(null);

    if (!apiKey) {
      setApiKeyError('API key is required');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setApiKeyError('Invalid API key format. Should start with "sk-"');
      return;
    }

    localStorage.setItem('openai_api_key', apiKey);
    setShowApiSettings(false);
    toast.success('API key saved successfully');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('pdPatchHistory');
  };

  const handleViewCode = (content: string) => {
    setCurrentPatch(prev => prev ? {...prev, content} : null);
  };

  // Add this section to display regeneration history in the explorer
  const RegenerationHistory = ({ patch, onViewCode }: { patch: PdPatch, onViewCode: (content: string) => void }) => {
    if (!patch.errorHistory?.length) return null;

    return (
      <div className="mt-4 space-y-3">
        <div className="text-xs text-gray-400">Regeneration History:</div>
        {patch.errorHistory.map((entry, index) => (
          <div key={index} className="text-xs bg-[#1e1e1e] rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-gray-400">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-orange-400 mb-1">Error:</div>
            <div className="text-gray-300 mb-2">{entry.error}</div>
            {entry.regeneratedPatch && (
              <div className="text-green-400">
                ✓ Regenerated solution available
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#1e1e1e] text-gray-300 flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Activity Bar */}
      <div className="fixed left-0 top-0 bottom-0 w-12 bg-[#333333] border-r border-[#404040] flex flex-col items-center py-2 z-10">
        <button 
          onClick={() => setActiveTab('explorer')}
          className={`p-2.5 ${activeTab === 'explorer' ? 'text-white bg-[#2d2d2d]' : 'text-gray-400'} hover:text-white transition-colors rounded-lg mb-2`}
        >
          <FileCode2 className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`p-2.5 ${activeTab === 'history' ? 'text-white bg-[#2d2d2d]' : 'text-gray-400'} hover:text-white transition-colors rounded-lg mb-2`}
        >
          <History className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`p-2.5 ${activeTab === 'settings' ? 'text-white bg-[#2d2d2d]' : 'text-gray-400'} hover:text-white transition-colors rounded-lg`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 pl-12 overflow-hidden">
        {/* Side Panel */}
        <div className="w-64 bg-[#252526] border-r border-[#404040] flex flex-col overflow-hidden">
          {/* Explorer Header - Fixed */}
          <div className="flex-none px-4 h-12 flex items-center justify-between border-b border-[#404040]">
            <span className="text-sm font-medium tracking-wide">
              {activeTab.toUpperCase()}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1 hover:bg-[#2d2d2d] rounded ${showSearch ? 'bg-[#2d2d2d]' : ''}`}
              >
                <Search className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-[#2d2d2d] rounded">
                <Command className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Add search input field */}
          {showSearch && (
            <div className="flex-none px-4 py-2 border-b border-[#404040]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patches..."
                className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#404040] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}
          
          {/* Explorer Content - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'history' ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#404040]">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">Generation History</span>
                  </div>
                  <button
                    onClick={() => clearHistory()}
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {history.map((patch: PdPatch, index: number) => (
                    <div
                      key={index}
                      onClick={() => setCurrentPatch(patch)}
                      className={`group px-3 py-2.5 rounded-md cursor-pointer transition-all
                                 hover:bg-[#2d2d2d] ${currentPatch?.name === patch.name ? 'bg-[#2d2d2d]' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <FileIcon className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-300 font-medium truncate">
                              {truncateText(patch.description, 40)}
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {new Date(patch.created).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {new Date(patch.created).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            
                            {patch.metadata.requiredObjects.length > 0 && (
                              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                <Package className="w-3 h-3" />
                                {patch.metadata.requiredObjects.length} objects
                              </span>
                            )}
                            
                            {patch.errorHistory && patch.errorHistory.length > 0 && (
                              <span className="text-xs text-orange-400/90 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" />
                                {patch.errorHistory.length} {patch.errorHistory.length === 1 ? 'error' : 'errors'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <History className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm">No generations yet</p>
                      <p className="text-xs mt-1 opacity-60">Generated patches will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'explorer' ? (
              <div className="h-full overflow-y-auto custom-scrollbar">
                {currentPatch ? (
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-300">{currentPatch.description}</div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(currentPatch.created).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[#1e1e1e] rounded-md overflow-hidden border border-[#404040]">
                      <PatchEditor content={currentPatch.content} />
                    </div>

                    {currentPatch.errorHistory && currentPatch.errorHistory.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-300">Error History</div>
                        <RegenerationHistory 
                          patch={currentPatch} 
                          onViewCode={handleViewCode}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <FileCode2 className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">No patch selected</p>
                    <p className="text-xs mt-1 opacity-60">Generate a patch to see it here</p>
                  </div>
                )}
              </div>
            ) : activeTab === 'settings' ? (
              <div className="p-4">
                <button
                  onClick={() => setShowApiSettings(true)}
                  className="w-full px-3 py-2 text-sm bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-md transition-colors text-left"
                >
                  Configure API Key
                </button>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-sm text-gray-500">
                  Explorer content goes here
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main Header - Fixed */}
          <div className="flex-none bg-[#1e1e1e] border-b border-[#404040]">
            <div className="h-12 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">Pure Data Patch Generator</span>
                {currentPatch && (
                  <span className="text-sm text-gray-500">
                    - {currentPatch.name}.pd
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowApiSettings(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors border ${
                    !apiKey 
                      ? 'bg-red-900/30 border-red-700/50 text-red-200 hover:bg-red-900/50' 
                      : 'bg-[#2d2d2d] border-[#404040] hover:bg-[#3d3d3d]'
                  }`}
                  title="API Settings"
                >
                  {!apiKey ? <AlertCircle className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  {!apiKey ? 'Set API Key' : 'API Key'}
                </button>
                {currentPatch && (
                  <>
                    <button
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#2d2d2d] rounded-md hover:bg-[#3d3d3d] transition-colors border border-[#404040]"
                      title="Toggle Explanation (⌘E)"
                    >
                      <Info className="w-4 h-4" />
                      {showExplanation ? 'Hide' : 'Show'} Explanation
                    </button>
                    <div className="h-6 border-l border-[#404040]" />
                  </>
                )}
                <div className="text-xs text-gray-500">
                  <kbd className="px-1.5 py-0.5 bg-[#2d2d2d] rounded border border-[#404040]">⌘</kbd>
                  +
                  <kbd className="px-1.5 py-0.5 bg-[#2d2d2d] rounded border border-[#404040] ml-1">Enter</kbd>
                  to generate
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#404040]">
              <textarea
                id="prompt"
                rows={3}
                className="w-full px-4 py-3 bg-[#1e1e1e] border border-[#404040] rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="// Describe your Pure Data patch (e.g., Create a simple synthesizer with frequency modulation)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Generate Patch
                </button>

                {currentPatch && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-md text-sm font-medium transition-colors border border-[#404040]"
                    title="Download Patch (⌘S)"
                  >
                    <Download className="w-4 h-4" />
                    Download .pd
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Patch Editor */}
            {currentPatch && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <PatchEditor content={currentPatch.content} />
              </div>
            )}

            {/* Explanation Panel */}
            {currentPatch && showExplanation && (
              <div className="w-80 border-l border-[#404040] bg-[#1e1e1e] flex flex-col overflow-hidden">
                <div className="flex-none h-12 border-b border-[#404040] flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-sm">Patch Explanation</span>
                  </div>
                  <button
                    onClick={() => setShowExplanation(false)}
                    className="p-1 hover:bg-[#2d2d2d] rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {currentPatch.explanation}
                  </div>
                </div>
              </div>
            )}

            {currentPatch && (
              <div className="w-80 border-l border-[#404040] bg-[#1e1e1e] flex flex-col overflow-hidden">
                {/* Error Feedback Header */}
                <div className="flex-none h-12 border-b border-[#404040] flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-orange-400" />
                    <span className="font-medium text-sm">Error Feedback</span>
                  </div>
                  {pdErrors && (
                    <button
                      onClick={() => setPdErrors('')}
                      className="p-1 hover:bg-[#2d2d2d] rounded"
                      title="Clear errors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Error Input Section */}
                <div className="p-4 border-b border-[#404040]">
                  <textarea
                    id="pdErrors"
                    rows={4}
                    className="w-full px-3 py-2 bg-[#252526] border border-[#404040] rounded-md font-mono text-sm 
                             focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 
                             placeholder-gray-500 resize-none custom-scrollbar"
                    placeholder="Paste Pure Data error messages here..."
                    value={pdErrors}
                    onChange={(e) => setPdErrors(e.target.value)}
                  />
                  
                  <button
                    onClick={() => handleRegenerate(pdErrors)}
                    disabled={isRegenerating || !pdErrors.trim()}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 
                             bg-gradient-to-b from-orange-600 to-orange-700 
                             hover:from-orange-500 hover:to-orange-600 rounded-md text-sm font-medium 
                             transition-all disabled:opacity-50 disabled:cursor-not-allowed 
                             disabled:hover:from-orange-600 disabled:hover:to-orange-700 shadow-sm"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Regenerating Patch...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Regenerate with Fixes</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Revision History Section */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-gray-400">Revision History</h3>
                      </div>
                      <span className="text-xs text-gray-500">{history.length} items</span>
                    </div>

                    <div className="space-y-2">
                      {history.map((patch: PdPatch, index: number) => (
                        <div
                          key={index}
                          onClick={() => setCurrentPatch(patch)}
                          className={`group rounded-lg border transition-all
                            ${currentPatch?.name === patch.name 
                              ? 'border-orange-500/20 bg-orange-500/5' 
                              : 'border-[#404040] hover:border-orange-500/20 hover:bg-[#2d2d2d]'
                            }`}
                        >
                          <div className="px-3 py-2">
                            <div className="flex items-start gap-2.5">
                              <FileIcon className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-200 font-medium truncate">
                                  {truncateText(patch.description, 40)}
                                </div>
                                
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {new Date(patch.created).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  
                                  {patch.metadata.requiredObjects.length > 0 && (
                                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                      <Package className="w-3 h-3" />
                                      {patch.metadata.requiredObjects.length} objects
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {patch.errorHistory && patch.errorHistory.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-[#404040]/50">
                                {patch.errorHistory.map((error, errorIndex) => (
                                  <div key={errorIndex} className="flex items-start gap-2 mt-2 first:mt-0">
                                    <AlertCircle className="w-3.5 h-3.5 text-orange-400/90 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-orange-400/90 line-clamp-1">
                                        {error.error}
                                      </div>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] text-gray-500">
                                          {new Date(error.timestamp).toLocaleString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                        {error.regeneratedPatch && (
                                          <span className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                                            <CheckCircle className="w-2.5 h-2.5" />
                                            Fixed
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;