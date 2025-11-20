
import { AnalysisResult, CodeFile, GraphLink, GraphNode, NodeType } from "../types";

// Helper to generate unique IDs for nodes
const generateId = (type: string, name: string, file: string) => `${type}:${file}:${name}`;

// Naive scope ending detection
const determineEndLine = (lines: string[], startIdx: number, type: 'PYTHON' | 'JS' | 'C_CPP'): number => {
    if (type === 'PYTHON') {
        // Indentation based strategy
        const startLine = lines[startIdx];
        const startIndent = startLine.search(/\S/);
        if (startIndent === -1) return startIdx + 1; 

        for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue; // Skip empty lines
            const indent = line.search(/\S/);
            // If we find a line with same or less indent, the previous block has ended
            if (indent > -1 && indent <= startIndent) {
                return i; 
            }
        }
        return lines.length;
    } else {
        // Brace counting strategy (JS, Java, C, C++)
        let braceCount = 0;
        let foundBrace = false;
        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if ((line.match(/\{/g) || []).length > 0) foundBrace = true;
            
            // If we found an opening brace and count returns to 0, block ended
            if (foundBrace && braceCount <= 0) return i + 1;
        }
        // Fallback if no braces found or unbalanced
        return Math.min(startIdx + 20, lines.length); 
    }
};

/**
 * depth:
 * 1 = Files only (and import links)
 * 2 = Files + Classes
 * 3 = Files + Classes + Functions
 */
export const analyzeCodebase = async (files: CodeFile[], depth: number = 3): Promise<AnalysisResult> => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const fileNodes = new Map<string, string>(); // Path -> Node ID

  // 1. Create Nodes for all files first
  files.forEach(f => {
    const id = `FILE:${f.path}`;
    nodes.push({
      id,
      label: f.name,
      type: NodeType.FILE,
      file: f.path,
      startLine: 1,
      endLine: f.content.split('\n').length,
      details: `File: ${f.path}`
    });
    fileNodes.set(f.path, id);
  });

  // 2. Parse content based on depth
  files.forEach(f => {
    const lines = f.content.split('\n');
    const fileId = fileNodes.get(f.path)!;
    
    // Track current container for hierarchical links (File -> Class -> Function)
    let currentClass: GraphNode | null = null;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed) return;

      // --- PYTHON PARSING ---
      if (f.path.endsWith('.py')) {
        // Class (Depth >= 2)
        if (depth >= 2) {
            const classMatch = line.match(/^class\s+(\w+)/);
            if (classMatch) {
               const name = classMatch[1];
               const id = generateId('CLASS', name, f.path);
               const endLine = determineEndLine(lines, index, 'PYTHON');
               
               const node: GraphNode = {
                 id, 
                 label: name, 
                 type: NodeType.CLASS, 
                 file: f.path, 
                 startLine: lineNum, 
                 endLine: endLine,
                 details: `Class definition in ${f.name}`
               };
               nodes.push(node);
               links.push({ source: fileId, target: id, type: 'CONTAINS' });
               currentClass = node;
               return; 
            }
        }

        // Function (Depth >= 3)
        if (depth >= 3) {
            const funcMatch = line.match(/^\s*def\s+(\w+)/);
            if (funcMatch) {
                const name = funcMatch[1];
                const id = generateId('FUNCTION', name, f.path);
                const endLine = determineEndLine(lines, index, 'PYTHON');
                
                const node: GraphNode = {
                    id, 
                    label: name, 
                    type: NodeType.FUNCTION, 
                    file: f.path, 
                    startLine: lineNum, 
                    endLine: endLine,
                    details: `Function definition in ${f.name}`
                };
                nodes.push(node);
                
                // Check indent to see if it belongs to the class
                const indent = line.search(/\S/);
                if (indent > 0 && currentClass) {
                    // Simple check: if indent is greater than 0, assume it's a method if we saw a class
                    links.push({ source: currentClass.id, target: id, type: 'CONTAINS' });
                } else {
                    links.push({ source: fileId, target: id, type: 'CONTAINS' });
                    currentClass = null; // Reset class context if we hit a top-level def
                }
            }
        }

        // Imports (Always parse to show dependencies between files)
        const importMatch = line.match(/^(?:from|import)\s+(\w+)/);
        if (importMatch) {
            const moduleName = importMatch[1];
            // Attempt to link to other files
            for (const [path, fid] of fileNodes.entries()) {
                // e.g. "import utils" matches "utils.py"
                if (path.includes(moduleName) && path !== f.path) {
                    links.push({ source: fileId, target: fid, type: 'IMPORT' });
                }
            }
        }
      }
      
      // --- JS/TS PARSING ---
      else if (f.path.match(/\.(js|ts|jsx|tsx)$/)) {
          // Class (Depth >= 2)
          if (depth >= 2) {
            const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
            if (classMatch) {
                const name = classMatch[1];
                const id = generateId('CLASS', name, f.path);
                const endLine = determineEndLine(lines, index, 'JS');
                
                nodes.push({
                    id, 
                    label: name, 
                    type: NodeType.CLASS, 
                    file: f.path, 
                    startLine: lineNum, 
                    endLine: endLine,
                    details: `Class definition in ${f.name}`
                });
                links.push({ source: fileId, target: id, type: 'CONTAINS' });
            }
          }
          
          // Function (Depth >= 3)
          if (depth >= 3) {
            const funcMatch = line.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|const\s+(\w+)\s*=\s*(?:async\s*)?\w+\s*=>/);
            if (funcMatch) {
                const name = funcMatch[1] || funcMatch[2] || funcMatch[3];
                if (name) {
                    const id = generateId('FUNCTION', name, f.path);
                    const endLine = determineEndLine(lines, index, 'JS');
                    
                    nodes.push({
                        id, 
                        label: name, 
                        type: NodeType.FUNCTION, 
                        file: f.path, 
                        startLine: lineNum, 
                        endLine: endLine,
                        details: `Function definition in ${f.name}`
                    });
                    links.push({ source: fileId, target: id, type: 'CONTAINS' });
                }
            }
          }

          // Imports
          const importMatch = line.match(/from\s+['"](.+)['"]/);
          if (importMatch) {
              const pathPart = importMatch[1]; 
              // Naive filename matching
              const namePart = pathPart.split('/').pop();
              if (namePart) {
                  for (const [path, fid] of fileNodes.entries()) {
                      if (path.includes(namePart) && path !== f.path) {
                          links.push({ source: fileId, target: fid, type: 'IMPORT' });
                      }
                  }
              }
          }
      }

      // --- C/C++ PARSING ---
      else if (f.path.match(/\.(c|cpp|h|hpp|cc)$/)) {
           // Class/Struct (Depth >= 2)
           if (depth >= 2) {
             const classMatch = line.match(/^\s*(?:class|struct)\s+(\w+)/);
             if (classMatch) {
                 const name = classMatch[1];
                 const id = generateId('CLASS', name, f.path);
                 const endLine = determineEndLine(lines, index, 'C_CPP');
                 
                 const node: GraphNode = {
                   id, 
                   label: name, 
                   type: NodeType.CLASS, 
                   file: f.path, 
                   startLine: lineNum, 
                   endLine: endLine,
                   details: `Class/Struct definition in ${f.name}`
                 };
                 nodes.push(node);
                 links.push({ source: fileId, target: id, type: 'CONTAINS' });
             }
           }

           // Function (Depth >= 3)
           if (depth >= 3) {
                // Heuristic: [Return Type/Modifiers] [Name] ( [Args]
                // e.g., void myFunction(int x)
                // Exclude keywords
                const keywords = ['if', 'while', 'for', 'switch', 'return', 'catch', 'else', 'new', 'delete'];
                
                // Complex regex to try and catch standard C/C++ function definitions
                // 1. Type part (words, *, &, <, >, :) followed by space
                // 2. Name part (word, potential :: for C++ methods)
                // 3. Opening paren
                const funcMatch = line.match(/^\s*(?:[\w:*&<>]+\s+)+([\w:]+)\s*\(/);
                
                if (funcMatch) {
                    const name = funcMatch[1];
                    
                    // Filter control structures and forward declarations (ending in ;)
                    // We assume definitions end with { or are multi-line, but declarations end with ;
                    if (!keywords.includes(name) && !line.trim().endsWith(';')) {
                        const id = generateId('FUNCTION', name, f.path);
                        const endLine = determineEndLine(lines, index, 'C_CPP');
                        
                        const node: GraphNode = {
                            id, 
                            label: name, 
                            type: NodeType.FUNCTION, 
                            file: f.path, 
                            startLine: lineNum, 
                            endLine: endLine,
                            details: `Function definition in ${f.name}`
                        };
                        nodes.push(node);
                        links.push({ source: fileId, target: id, type: 'CONTAINS' });
                    }
                }
           }

           // Includes
           const includeMatch = line.match(/^#include\s+[<"](.+)[>"]/);
           if (includeMatch) {
                const includedPath = includeMatch[1];
                const includedName = includedPath.split('/').pop();
                if (includedName) {
                    for (const [path, fid] of fileNodes.entries()) {
                        // loose match: if the included file name exists in our file list
                        if (path.endsWith(includedName) && path !== f.path) {
                            links.push({ source: fileId, target: fid, type: 'IMPORT' });
                        }
                    }
                }
           }
      }
    });
  });

  // Summary generation
  const summary = `Offline analysis complete (Depth: ${depth}). 
  Scanned ${files.length} files. 
  Identified ${nodes.filter(n => n.type === NodeType.CLASS).length} classes and ${nodes.filter(n => n.type === NodeType.FUNCTION).length} functions.`;

  return Promise.resolve({
      nodes,
      links,
      summary
  });
};
