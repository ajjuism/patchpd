import { useState } from 'react';
import { Terminal, Loader2, Download, Play, FileCode2, Info, Settings, ChevronRight, Folder, History, Clock, Search, Command, X, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { generatePdPatch } from './lib/openai';
import { PatchEditor } from './components/PatchEditor';
import type { PdPatch } from './types';

function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<PdPatch | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [history, setHistory] = useState<PdPatch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdErrors, setPdErrors] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setPdErrors('');

    try {
      const result = await generatePdPatch(prompt);
      
      // Create new patch with complete metadata
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
      setHistory((prev: PdPatch[]) => [newPatch, ...prev]);
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

  const handleErrorFeedback = async () => {
    if (!pdErrors.trim() || !currentPatch) {
      toast.error('Please enter error feedback');
      return;
    }

    setIsRegenerating(true);
    try {
      const { patch, explanation } = await generatePdPatch(prompt, pdErrors);
      const newPatch: PdPatch = {
        name: `patch_${Date.now()}`,
        content: patch,
        explanation,
        description: `${prompt} (Regenerated with error fixes)`,
        created: new Date(),
        errorHistory: [
          {
            error: pdErrors,
            timestamp: new Date()
          },
          ...(currentPatch.errorHistory || [])
        ]
      };
      setCurrentPatch(newPatch);
      setHistory((prev: PdPatch[]) => [newPatch, ...prev]);
      setPdErrors(''); // Clear errors after successful regeneration
      toast.success('Patch regenerated with fixes!');
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

  return (
    <div className="h-screen bg-[#1e1e1e] text-gray-300 flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Activity Bar */}
      <div className="fixed left-0 top-0 bottom-0 w-12 bg-[#333333] border-r border-[#404040] flex flex-col items-center py-2 z-10">
        <button className="p-2.5 text-white bg-[#2d2d2d] rounded-lg mb-4">
          <FileCode2 className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`p-2.5 ${showHistory ? 'text-white bg-[#2d2d2d]' : 'text-gray-400'} hover:text-white transition-colors rounded-lg mb-2`}
        >
          <History className="w-5 h-5" />
        </button>
        <button className="p-2.5 text-gray-400 hover:text-white transition-colors rounded-lg">
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
              {showHistory ? 'HISTORY' : 'EXPLORER'}
            </span>
            <div className="flex items-center gap-2">
              <button className="p-1 hover:bg-[#2d2d2d] rounded">
                <Search className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-[#2d2d2d] rounded">
                <Command className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Explorer Content - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {showHistory ? (
              <div className="space-y-1">
                {history.map((patch, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentPatch(patch)}
                    className={`px-2 py-1.5 text-sm hover:bg-[#2d2d2d] rounded cursor-pointer ${
                      currentPatch?.name === patch.name ? 'bg-[#37373d]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="truncate">{patch.name}.pd</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6 mt-0.5 truncate">
                      {patch.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 px-2 py-1 text-sm">
                  <ChevronRight className="w-4 h-4" />
                  <Folder className="w-4 h-4 text-blue-400" />
                  <span className="opacity-80">PURE DATA PATCHES</span>
                </div>
                {currentPatch && (
                  <div className="ml-6 mt-1">
                    <div className="px-2 py-1 text-sm bg-[#37373d] rounded cursor-pointer flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-yellow-400" />
                      {currentPatch.name}.pd
                    </div>
                  </div>
                )}
              </>
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
                    onClick={handleErrorFeedback}
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
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-4 h-4 text-gray-400" />
                      <h3 className="text-sm font-medium text-gray-400">Revision History</h3>
                    </div>

                    {history
                      .filter((patch: PdPatch) => patch.description.includes("Regenerated"))
                      .map((patch: PdPatch, index: number) => (
                        <div
                          key={index}
                          onClick={() => setCurrentPatch(patch)}
                          className="mb-3 p-3 bg-[#252526] rounded-md cursor-pointer 
                                   hover:bg-[#2d2d2d] transition-colors
                                   border border-[#404040] border-opacity-50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <FileCode2 className="w-4 h-4 text-orange-400" />
                              <span className="text-sm font-medium text-gray-300">
                                Revision {index + 1}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(patch.created).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {patch.errorHistory && patch.errorHistory.length > 0 && (
                            <div className="mt-2 text-xs text-gray-400 bg-[#1e1e1e] rounded p-2 font-mono">
                              <div className="flex items-center gap-1 mb-1">
                                <AlertCircle className="w-3 h-3 text-orange-400" />
                                <span className="text-orange-400">Fixed Error:</span>
                              </div>
                              <div className="line-clamp-2">
                                {patch.errorHistory[0].error}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                    {history.filter((patch: PdPatch) => patch.description.includes("Regenerated")).length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No revisions yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Help Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowGettingStarted(true)}
          className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-colors"
          title="Getting Started"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Getting Started Popup */}
      {showGettingStarted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] rounded-lg shadow-xl w-[480px] border border-[#404040]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#404040]">
              <h3 className="text-sm font-medium">Getting Started</h3>
              <button
                onClick={() => setShowGettingStarted(false)}
                className="p-1 hover:bg-[#2d2d2d] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-sm space-y-3">
              <p>Welcome to the Pure Data Patch Generator! Here's how to get started:</p>
              <ol className="list-decimal list-inside space-y-2 pl-2">
                <li>Enter a description of the audio patch you want to create in the prompt box</li>
                <li>Click "Generate Patch" or press ⌘/Ctrl + Enter</li>
                <li>View the generated patch in the editor</li>
                <li>Read the explanation panel for details about how the patch works</li>
                <li>Download the .pd file to use in Pure Data</li>
              </ol>
              <div className="mt-4 p-3 bg-[#1e1e1e] rounded text-xs">
                <p className="font-medium mb-2">Keyboard Shortcuts:</p>
                <ul className="space-y-1">
                  <li>⌘/Ctrl + Enter: Generate patch</li>
                  <li>⌘/Ctrl + S: Download patch</li>
                  <li>⌘/Ctrl + E: Toggle explanation panel</li>
                  <li>⌘/Ctrl + H: Toggle history panel</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add API Settings Modal */}
      {showApiSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] rounded-lg shadow-xl w-[480px] border border-[#404040]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#404040]">
              <h3 className="text-sm font-medium">OpenAI API Settings</h3>
              <button
                onClick={() => {
                  setShowApiSettings(false);
                  setApiKeyError(null);
                }}
                className="p-1 hover:bg-[#2d2d2d] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleApiKeySubmit} className="p-4">
              <div className="space-y-2">
                <label htmlFor="apiKey" className="block text-sm font-medium">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyError(null);
                  }}
                  className={`w-full px-3 py-2 bg-[#1e1e1e] border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    apiKeyError 
                      ? 'border-red-500/50' 
                      : 'border-[#404040]'
                  }`}
                  placeholder="sk-..."
                />
                {apiKeyError && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {apiKeyError}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  Your API key will be stored locally in your browser and is never sent to our servers.
                </p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApiSettings(false);
                    setApiKeyError(null);
                  }}
                  className="px-3 py-2 text-sm bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Save API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#252526',
            color: '#fff',
            border: '1px solid #404040'
          }
        }}
      />
    </div>
  );
}

export default App;