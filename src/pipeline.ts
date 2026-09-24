import { tokenize } from "./Lexer.js";
import { DocParser } from "./Parser.js";
import { resolveTheme } from "./themeRegistry.js";
import { DocSyntaxError } from "./types.js";
import type { DocASTNode, DocDiagnostic, PreviewStyle } from "./types.js";

export interface AtDocPipelineResult {
    ast: DocASTNode[] | null;
    html: string | null;
    error: string | null;
    diagnostics: DocDiagnostic[];
}

/** 1-based source line number a character offset falls on — used to tag each top-level block's rendered HTML with `data-line`, the anchor scroll sync (MonacoCodeEditor.tsx / AtDocPreview.tsx) matches against. */
function lineForOffset(source: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < source.length; i++) {
        if (source.charCodeAt(i) === 10 /* \n */) line++;
    }
    return line;
}

/**
 * Renders `source` with the named theme — any id registered through
 * themeRegistry.ts's registerTheme(). Same AST whichever theme renders it;
 * only the theme's renderer (and the stylesheet the caller pairs it with)
 * differs, which is Renderer Independence made visible rather than merely
 * documented. An unknown or omitted `style` falls back to the default theme.
 * This pipeline names no theme itself, so a new theme needs no edit here.
 */
export function runAtDocPipeline(source: string, style?: PreviewStyle): AtDocPipelineResult {
    const renderer = resolveTheme(style);
    try {
        const tokens = tokenize(source);
        const parser = new DocParser(tokens);
        const ast = parser.parse();
        // A zero-height marker placed right before each block (not a wrapper) —
        // exists purely so the preview can locate "which block came from which
        // source line" for scroll sync (see AtDocPreview.tsx's getLineAnchors),
        // without any theme needing to know about it. It must be a real,
        // normally-laid-out block (not `display:contents`/`display:none`,
        // neither of which generates a box — getBoundingClientRect() on those
        // returns an all-zero rect in most browsers, which silently breaks the
        // anchor math). `height:0; overflow:hidden` makes it take no visual
        // space while still reporting an accurate position in the flow.
        const bodyHTML = ast.map((node) => {
            const inner = renderer.renderNode(node);
            if (typeof node.start !== "number") return inner;
            const line = lineForOffset(source, node.start);
            return `<div data-line="${line}" style="height:0;overflow:hidden"></div>${inner}`;
        }).join("\n");
        const footnotesHTML = renderer.renderFootnotes(ast);
        const html = footnotesHTML ? `${bodyHTML}\n${footnotesHTML}` : bodyHTML;
        return { ast, html, error: null, diagnostics: parser.diagnostics };
    } catch (err) {
        if (err instanceof DocSyntaxError) {
            return { ast: null, html: null, error: err.message, diagnostics: [] };
        }
        throw err;
    }
}

/** Lightweight entry point for the editor — only needs the non-fatal diagnostics, not the rendered HTML. */
export function getAtDocDiagnostics(source: string): DocDiagnostic[] {
    try {
        const parser = new DocParser(tokenize(source));
        parser.parse();
        return parser.diagnostics;
    } catch {
        return [];
    }
}
