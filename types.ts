export interface CodeFile {
  name: string;
  path: string;
  content: string;
  language?: string;
}

export enum NodeType {
  FILE = 'FILE',
  CLASS = 'CLASS',
  FUNCTION = 'FUNCTION',
  MODULE = 'MODULE'
}

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  file?: string; // The file this node belongs to
  line?: number;
  startLine?: number;
  endLine?: number;
  details?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'IMPORT' | 'CALL' | 'INHERITANCE' | 'CONTAINS';
}

export interface AnalysisResult {
  nodes: GraphNode[];
  links: GraphLink[];
  summary: string;
}