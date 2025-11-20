
import React, { useState, useMemo, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { D3Graph } from './components/D3Graph';
import { CodeFile, AnalysisResult, GraphNode, NodeType } from './types';
import { analyzeCodebase } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  
  // New Features State
  const [depth, setDepth] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [repulsion, setRepulsion] = useState<number>(50);

  // Re-run analysis when files or depth changes
  useEffect(() => {
    if (files.length === 0) return;

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setSelectedNode(null);
    
        try {
          const result = await analyzeCodebase(files, depth);
          setAnalysis(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error during analysis");
        } finally {
          setLoading(false);
        }
    };

    runAnalysis();
  }, [files, depth]);

  const handleFilesLoaded = (loadedFiles: CodeFile[]) => {
    setFiles(loadedFiles);
  };

  const searchResults = useMemo(() => {
    if (!analysis || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();

    return analysis.nodes.filter(n => {
        // 1. Search metadata (Name, File path)
        if (n.label.toLowerCase().includes(q) || (n.file && n.file.toLowerCase().includes(q))) {
            return true;
        }

        // 2. Search Content
        if (!n.file) return false;
        
        const file = files.find(f => f.path === n.file);
        if (!file) return false;

        let contentToCheck = "";
        // Check specific scope if start/end lines exist
        if (n.startLine !== undefined && n.endLine !== undefined) {
             const lines = file.content.split('\n');
             // Arrays are 0-indexed, lines are 1-indexed
             contentToCheck = lines.slice(n.startLine - 1, n.endLine).join('\n');
        } else {
             contentToCheck = file.content;
        }
        
        return contentToCheck.toLowerCase().includes(q);
    });
  }, [analysis, searchQuery, files]);

  const nodeDetails = useMemo(() => {
    if (!selectedNode || !analysis) return null;

    const connectedLinks = analysis.links.filter(
        l => l.source === selectedNode.id || l.target === selectedNode.id
    );
    
    return {
        ...selectedNode,
        connections: connectedLinks.length
    };
  }, [selectedNode, analysis]);

  const getCodeSnippet = (node: GraphNode) => {
    const file = files.find(f => f.path === node.file);
    if (!file) return "// File content not found locally.";

    if (node.type === NodeType.FILE || !node.startLine || !node.endLine) {
        return file.content;
    }

    const lines = file.content.split('\n');
    const start = Math.max(0, node.startLine - 1);
    const end = Math.min(lines.length, node.endLine);
    
    if (start >= end) return file.content;

    return lines.slice(start, end).join('\n');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 z-10">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight">CodeGraph Offline</h1>
                <p className="text-xs text-slate-400">Static Analysis & Visualization</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {analysis && (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {analysis.nodes.length} Nodes
                </span>
            )}
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-slate-400">Offline Mode</span>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar */}
        <div className="w-[450px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20 shadow-xl relative">
            
            {/* Top: Controls */}
            <div className="p-6 border-b border-slate-800 bg-slate-900 space-y-6">
                <FileUploader onFilesLoaded={handleFilesLoaded} />
                
                {files.length > 0 && (
                    <>
                        {/* Depth Control */}
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Graph Depth</label>
                                <span className="text-xs text-indigo-400 font-mono">
                                    {depth === 1 ? 'Files Only' : depth === 2 ? 'Structure' : 'Full Detail'}
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="3" 
                                step="1"
                                value={depth}
                                onChange={(e) => setDepth(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                                <span>Files</span>
                                <span>Classes</span>
                                <span>Functions</span>
                            </div>
                        </div>

                        {/* Repulsion Control */}
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Graph Spread</label>
                                <span className="text-xs text-indigo-400 font-mono">{repulsion}</span>
                            </div>
                            <input 
                                type="range" 
                                min="10" 
                                max="300" 
                                step="10"
                                value={repulsion}
                                onChange={(e) => setRepulsion(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Middle: Details / Search Results */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-20">
                
                {loading && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-indigo-400 animate-pulse">Analyzing structure...</p>
                    </div>
                )}

                {!loading && searchQuery && (
                    <div>
                        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center justify-between">
                            Search Results
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">{searchResults.length}</span>
                        </h2>
                        {searchResults.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No nodes found matching "{searchQuery}" in name or content.</p>
                        ) : (
                            <div className="space-y-2">
                                {searchResults.map(node => (
                                    <button 
                                        key={node.id}
                                        onClick={() => {
                                            setSelectedNode(node);
                                            setSearchQuery(''); // Clear search query to show details view
                                        }}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedNode?.id === node.id ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="font-medium text-sm">{node.label}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full ${
                                                node.type === NodeType.FILE ? 'bg-blue-500' : 
                                                node.type === NodeType.CLASS ? 'bg-yellow-500' : 
                                                'bg-pink-500'
                                            }`}></span>
                                            <span className="truncate max-w-[200px]">{node.file}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!loading && !searchQuery && selectedNode && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded text-slate-950 
                                    ${selectedNode.type === NodeType.FILE ? 'bg-blue-500' : 
                                      selectedNode.type === NodeType.CLASS ? 'bg-yellow-500' : 
                                      selectedNode.type === NodeType.FUNCTION ? 'bg-pink-500' : 'bg-purple-500'}`}>
                                    {selectedNode.type}
                                </span>
                                {/* @ts-ignore */}
                                {selectedNode.connections !== undefined && (
                                     <span className="text-xs text-slate-500">
                                        {/* @ts-ignore */}
                                        {selectedNode.connections} Connection(s)
                                     </span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white break-all">{selectedNode.label}</h3>
                            {selectedNode.file && (
                                <p className="text-xs text-slate-500 font-mono">{selectedNode.file} {selectedNode.startLine ? `:${selectedNode.startLine}` : ''}</p>
                            )}
                        </div>
                        
                        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800">
                            <h4 className="text-xs text-indigo-400 uppercase mb-2 font-semibold">Responsibility</h4>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                {selectedNode.details || "No description available."}
                            </p>
                        </div>

                        <div className="flex-1 min-h-0">
                            <h4 className="text-xs text-indigo-400 uppercase mb-2 font-semibold">Source Code</h4>
                            <div className="relative bg-slate-950 rounded-lg border border-slate-800 overflow-hidden group">
                                <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre max-h-96 overflow-y-auto custom-scrollbar">
                                    {getCodeSnippet(selectedNode)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !searchQuery && !selectedNode && analysis && (
                    <div className="text-sm text-slate-400">
                        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">Overview</h2>
                        <p className="mb-4 text-slate-300">{analysis.summary}</p>
                        <p>Use the search bar below or click on the graph to view node details.</p>
                    </div>
                )}
            </div>

            {/* Bottom: Search Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search code content..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (!e.target.value) setSelectedNode(null); // Clear selection on clear
                        }}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-md leading-5 bg-slate-950 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => { setSearchQuery(''); setSelectedNode(null); }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Graph Area */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden">
            {!analysis && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                    <div className="text-center">
                        <div className="text-6xl text-slate-800 font-black mb-4">EMPTY</div>
                        <p className="text-slate-600">Upload files to generate graph</p>
                    </div>
                </div>
            )}
            
            {analysis && (
                <D3Graph 
                    data={analysis} 
                    onNodeSelect={setSelectedNode} 
                    repulsion={repulsion}
                    selectedNodeId={selectedNode?.id}
                />
            )}
        </div>

      </main>
    </div>
  );
};

export default App;
