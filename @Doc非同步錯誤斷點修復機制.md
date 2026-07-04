// src/types.ts
export interface AtDocBreakpointError {
  line: number;
  column: number;
  nodeType: string;
  rawText: string;
  fixSuggestion: string;
}