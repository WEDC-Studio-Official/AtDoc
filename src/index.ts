// Public entry point for atdoc-core — the @Doc language engine
// (Lexer -> Parser -> Serializer -> Adapters) shared by every consumer in
// this monorepo. Renderer themes plug in through themeRegistry.ts; only the
// public ones (see package.json's atdoc.publicThemes) are imported here — the
// rest are registered by the generated src/internal.ts.

export type { TokenType, Token, RawEscape } from './Lexer.js';
export { tokenize } from './Lexer.js';

export { DocParser } from './Parser.js';

export type {
  SerializeResult,
  Placement,
  NodeSerializationContext,
} from './Serializer.js';
export {
  serializeDocument,
  serializeNode,
  canonicalizeNode,
  validateSerializableNode,
  unsupportedContentModes,
} from './Serializer.js';

export type {
  NodeKind,
  ContentMode,
  ParenMode,
  ParenRole,
  StyleSet,
  DerivedParenFields,
  NodeDef,
  SlotSuggestion,
} from './registry.js';
export {
  parseImgOptions,
  clampLevel,
  isOrderedParen,
  deriveParenFields,
  getNodeDef,
  isKnownCommand,
  getAliasInfo,
  getAllAliasDefs,
  getAllNodeDefs,
  isCellAllowedNode,
  getParenSuggestions,
  getStyleSuggestions,
} from './registry.js';

export * from './editor/monarch.js';

export type { DocASTNode, DocDiagnostic, PreviewStyle } from './types.js';
export { DocSyntaxError } from './types.js';

export { DocTranspiler } from './index/Adapters.js';

export type { ThemeDefinition } from './themeRegistry.js';
export { registerTheme, getTheme, hasTheme, listThemes, getDefaultTheme, resolveTheme } from './themeRegistry.js';

export type { AtDocPipelineResult } from './pipeline.js';
export { runAtDocPipeline, getAtDocDiagnostics } from './pipeline.js';

export type { MarkdownImportResult } from './markdownImport.js';
export { convertMarkdownToAtDoc, SUPPORTED_MARKDOWN_FEATURES } from './markdownImport.js';
