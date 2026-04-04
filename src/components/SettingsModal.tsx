import React, { useState, useEffect } from "react";
import { X, Download, Upload, Folder, Globe, Database, Settings, Sparkles, TestTube } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

type Tab = "general" | "ai" | "heuristics" | "backup";

interface LLmConfig {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
  autoCategorizeOnAdd: boolean;
  fallbackToLocal: boolean;
}

interface LocalHeuristicsConfig {
  enabled: boolean;
  domainCategoryRules: Record<string, string>;
}

export function SettingsModal({
  isOpen,
  onClose,
  onBackup,
  onRestore,
  setToast,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [dataDir, setDataDir] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [llm, setLlm] = useState<LLmConfig>({
    enabled: false,
    provider: 'openrouter',
    apiKey: '',
    model: 'stepfun/step-3.5-flash:free',
    autoCategorizeOnAdd: true,
    fallbackToLocal: true
  });
  const [localHeuristics, setLocalHeuristics] = useState<LocalHeuristicsConfig>({
    enabled: true,
    domainCategoryRules: {
      "youtube.com": "Videos",
      "youtu.be": "Videos",
      "github.com": "Programming",
      "npmjs.com": "Programming",
      "dribbble.com": "Design",
      "behance.com": "Design"
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.dataDir !== undefined) setDataDir(data.dataDir);
          if (data.userAgent !== undefined) setUserAgent(data.userAgent);
          if (data.llm) setLlm(data.llm);
          if (data.localHeuristics) setLocalHeuristics(data.localHeuristics);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          dataDir, 
          userAgent,
          llm,
          localHeuristics
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ message: data.message || "Settings saved successfully", type: "success" });
      } else {
        setToast({ message: data.error || "Failed to save settings", type: "error" });
      }
    } catch (e) {
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!llm.apiKey) {
      setToast({ message: "Please enter API key first", type: "error" });
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch("/api/llm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: llm.provider,
          apiKey: llm.apiKey,
          model: llm.model
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ message: "Connection successful!", type: "success" });
      } else {
        setToast({ message: `Connection failed: ${data.error}`, type: "error" });
      }
    } catch (e) {
      setToast({ message: "Connection test failed", type: "error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDomainRuleChange = (domain: string, category: string) => {
    setLocalHeuristics(prev => ({
      ...prev,
      domainCategoryRules: {
        ...prev.domainCategoryRules,
        [domain]: category
      }
    }));
  };

  const handleRemoveDomainRule = (domain: string) => {
    setLocalHeuristics(prev => {
      const newRules = { ...prev.domainCategoryRules };
      delete newRules[domain];
      return { ...prev, domainCategoryRules: newRules };
    });
  };

  const handleAddDomainRule = () => {
    setLocalHeuristics(prev => ({
      ...prev,
      domainCategoryRules: {
        ...prev.domainCategoryRules,
        "": ""
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col h-[550px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 bg-slate-50 border-r border-slate-100 p-4 flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "general"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Settings size={16} />
              General
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "ai"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Sparkles size={16} />
              AI & LLM
            </button>
            <button
              onClick={() => setActiveTab("heuristics")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "heuristics"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Globe size={16} />
              Local Heuristics
            </button>
            <button
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "backup"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Database size={16} />
              Backup & Restore
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
             {activeTab === "general" && (
               <div className="space-y-6">
                 <div>
                   <h3 className="text-sm font-medium text-slate-900 mb-3">Data Directory</h3>
                   <p className="text-sm text-slate-500 mb-4">
                     Choose where your database and application files are stored.
                   </p>
                   
                   <div className="flex flex-col gap-3">
                     <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                       <Folder size={18} className="text-slate-400" />
                       <input
                         type="text"
                         value={dataDir}
                         onChange={(e) => setDataDir(e.target.value)}
                         className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                         placeholder="e.g. C:\LinkHub\Data"
                       />
                     </div>
                   </div>
                 </div>

                 <div>
                   <h3 className="text-sm font-medium text-slate-900 mb-3">Web Scraper</h3>
                   <p className="text-sm text-slate-500 mb-4">
                     Set the User-Agent used when fetching link previews and reading content.
                   </p>
                   
                   <div className="flex flex-col gap-3">
                     <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                       <Globe size={18} className="text-slate-400 flex-shrink-0" />
                       <input
                         type="text"
                         value={userAgent}
                         onChange={(e) => setUserAgent(e.target.value)}
                         className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                         placeholder="Mozilla/5.0 (compatible; Twitterbot/1.0)"
                       />
                     </div>
                   </div>
                 </div>
                 
                 <button
                   onClick={handleSaveSettings}
                   disabled={isSaving || !dataDir}
                   className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors mt-6"
                 >
                   {isSaving ? "Saving..." : "Save Settings"}
                 </button>
               </div>
             )}

            {activeTab === "ai" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">LLM Categorization (OpenRouter)</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Configure OpenRouter to automatically categorize and tag your bookmarks using AI.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="llmEnabled"
                        checked={llm.enabled}
                        onChange={(e) => setLlm(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="llmEnabled" className="text-sm font-medium text-slate-700">Enable LLM categorization</label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Provider</label>
                      <select
                        value={llm.provider}
                        onChange={(e) => setLlm(prev => ({ ...prev, provider: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled
                      >
                        <option value="openrouter">OpenRouter</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Only OpenRouter is supported currently</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">API Key</label>
                      <input
                        type="password"
                        value={llm.apiKey}
                        onChange={(e) => setLlm(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="sk-or-..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
                      <select
                        value={llm.model}
                        onChange={(e) => setLlm(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <optgroup label="Free models">
                          <option value="stepfun/step-3.5-flash:free">Step AI Step-3.5 Flash (Free)</option>
                          <option value="nvidia/nemotron-3-super-120b-a12b:free">NVIDIA Nemotron-3 Super (Free)</option>
                          <option value="arcee-ai/trinity-large-preview:free">Arcee Trinity Large (Free)</option>
                        </optgroup>
                        <optgroup label="Paid (low cost)">
                          <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini (~$0.1/M)</option>
                          <option value="anthropic/claude-3-haiku">Anthropic Claude 3 Haiku (~$0.2/M)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoCategorize"
                        checked={llm.autoCategorizeOnAdd}
                        onChange={(e) => setLlm(prev => ({ ...prev, autoCategorizeOnAdd: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="autoCategorize" className="text-sm font-medium text-slate-700">Auto-categorize on add</label>
                      <span className="text-xs text-slate-500">(automatically categorize when adding bookmarks)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fallbackLocal"
                        checked={llm.fallbackToLocal}
                        onChange={(e) => setLlm(prev => ({ ...prev, fallbackToLocal: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="fallbackLocal" className="text-sm font-medium text-slate-700">Fallback to local heuristics</label>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <button
                        onClick={handleTestConnection}
                        disabled={isTesting || !llm.apiKey}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        <TestTube size={16} />
                        {isTesting ? "Testing..." : "Test Connection"}
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors mt-6"
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}

             {activeTab === "heuristics" && (
               <div className="space-y-6">
                 <div>
                   <h3 className="text-sm font-medium text-slate-900 mb-3">Local Heuristics Rules</h3>
                   <p className="text-sm text-slate-500 mb-4">
                      Define domain-to-collection mappings for automatic categorization when LLM is unavailable or disabled.
                    </p>
                    
                    <div className="space-y-3">
                      {Object.entries(localHeuristics.domainCategoryRules).map(([domain, collection]) => (
                        <div key={domain} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={domain}
                            onChange={(e) => handleDomainRuleChange(domain, e.target.value)}
                            placeholder="domain.com"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-slate-400">→</span>
                          <input
                            type="text"
                            value={collection}
                            onChange={(e) => handleDomainRuleChange(domain, e.target.value)}
                            placeholder="Collection Name"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleRemoveDomainRule(domain)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove rule"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      
                      <button
                        onClick={handleAddDomainRule}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 rounded-lg font-medium transition-colors"
                      >
                        + Add Domain Rule
                      </button>
                    </div>

                    <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-800 mb-2">Existing Collections</h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Make sure these match collection names in your database exactly:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['Articles', 'Design', 'Programming', 'Videos', 'Inbox'].map(cat => (
                          <span key={cat} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                            {cat}
                          </span>
                        ))}
                     </div>
                   </div>
                 </div>
                 
                 <button
                   onClick={handleSaveSettings}
                   disabled={isSaving}
                   className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                 >
                   {isSaving ? "Saving..." : "Save Settings"}
                 </button>
               </div>
             )}

            {activeTab === "backup" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Backup & Restore</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Backup your bookmarks, categories, and tags to a JSON file, or restore them from a previous backup.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={onBackup}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                    >
                      <Download size={18} />
                      Download Backup
                    </button>
                    
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/backup");
                          const data = await res.json();
                          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                          setToast({ message: "Backup copied to clipboard!", type: "success" });
                        } catch (e) {
                          setToast({ message: "Failed to copy backup to clipboard", type: "error" });
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      Copy Backup to Clipboard
                    </button>
                    
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors cursor-pointer">
                      <input type="file" accept=".json" className="hidden" onChange={onRestore} />
                      <Upload size={18} />
                      Restore from Backup
                    </label>
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
