import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Card, BlockStack, Select, Box } from "@shopify/polaris";
import { DiffEditor, useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  language?: string;
  title?: string;
}

function DiffViewer({
  oldValue,
  newValue,
  language = "plaintext",
  title,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<"split" | "inline">("inline");
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const originalEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const modifiedEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monaco = useMonaco();

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      readOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on" as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: "on",
      renderOverviewRuler: false,
      fontSize: 14,
      contextmenu: false,
      folding: true,
      renderIndicators: true,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontalScrollbarSize: 14,
      },
    }),
    [],
  );
  const diffOptions = useMemo<editor.IDiffEditorConstructionOptions>(
    () => ({
      ...options,
      renderSideBySide: viewMode === "split",
      originalEditable: false,
      renderOverviewRuler: false,
      renderIndicators: true,
      enableSplitViewResizing: true,
      ignoreTrimWhitespace: false,
      renderMarginRevertIcon: true,
      diffWordWrap: "on",
      diffCodeLens: true,
      accessibilitySupport: "on",
      multiCursorModifier: "alt",
      emptySelectionClipboard: true,
      copyWithSyntaxHighlighting: true,
      showMoves: true,
      lineDecorationsWidth: 5,
      contextmenu: true,
      renderSideByScale: true,
      readOnly: false,

      modifiedEditable: false,
      hideUnchangedRegions: {
        enabled: viewMode === "inline",
        minimumLineCount: 5,
      },
    }),
    [options, viewMode],
  );

  const computeDiffs = useCallback(() => {
    if (!monaco || !originalEditorRef.current || !modifiedEditorRef.current)
      return [];

    // Create models for comparison
    const originalModel = monaco.editor.createModel(oldValue, language);
    const modifiedModel = monaco.editor.createModel(newValue, language);

    // Use diffEditor to compute differences
    const diffEditor = monaco.editor.createDiffEditor(
      document.createElement("div"),
      {
        ...options,
        renderSideBySide: true,
      },
    );

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    // Get the line changes
    const lineChanges = diffEditor.getLineChanges() || [];

    // Clean up
    diffEditor.dispose();
    originalModel.dispose();
    modifiedModel.dispose();

    return lineChanges;
  }, [monaco, oldValue, newValue, language, options]);

  const applyDiffDecorations = useCallback(() => {
    if (!monaco || !originalEditorRef.current || !modifiedEditorRef.current)
      return;

    // Clear existing decorations
    const oldDecorations =
      originalEditorRef.current.getModel()?.getAllDecorations() || [];
    const newDecorations =
      modifiedEditorRef.current.getModel()?.getAllDecorations() || [];
    originalEditorRef.current.deltaDecorations(
      oldDecorations.map((d) => d.id),
      [],
    );
    modifiedEditorRef.current.deltaDecorations(
      newDecorations.map((d) => d.id),
      [],
    );

    const lineChanges = computeDiffs();

    // Apply decorations for each diff
    const originalDecorations = [];
    const modifiedDecorations = [];

    for (const change of lineChanges) {
      if (change.originalEndLineNumber >= change.originalStartLineNumber) {
        originalDecorations.push({
          range: new monaco.Range(
            change.originalStartLineNumber,
            1,
            change.originalEndLineNumber,
            1,
          ),
          options: {
            isWholeLine: true,
            className: "diff-line-delete",
            linesDecorationsClassName: "diff-gutter-delete",
          },
        });
      }

      if (change.modifiedEndLineNumber >= change.modifiedStartLineNumber) {
        modifiedDecorations.push({
          range: new monaco.Range(
            change.modifiedStartLineNumber,
            1,
            change.modifiedEndLineNumber,
            1,
          ),
          options: {
            isWholeLine: true,
            className: "diff-line-add",
            linesDecorationsClassName: "diff-gutter-add",
          },
        });
      }
    }

    // Apply the decorations to both editors
    originalEditorRef.current.deltaDecorations([], originalDecorations);
    modifiedEditorRef.current.deltaDecorations([], modifiedDecorations);
  }, [monaco, computeDiffs]);

  const handleViewModeChange = useCallback(
    (value: string) => {
      setViewMode(value as "split" | "inline");
      setTimeout(() => {
        editorRef.current?.layout();
        // Re-apply decorations when view mode changes
        if (monaco && originalEditorRef.current && modifiedEditorRef.current) {
          applyDiffDecorations();
        }
      }, 50);
    },
    [monaco, applyDiffDecorations],
  );

  const handleEditorDidMount = (editor: editor.IStandaloneDiffEditor) => {
    editorRef.current = editor;
    editor.layout();
  };

  useEffect(() => {
    if (!monaco || !originalEditorRef.current || !modifiedEditorRef.current)
      return;

    if (viewMode === "split") {
      applyDiffDecorations();
    }

    // Sync scrolling between editors in split mode
    let disposable: { dispose: () => void } | undefined;

    if (viewMode === "split") {
      disposable = originalEditorRef.current.onDidScrollChange((e) => {
        if (modifiedEditorRef.current) {
          modifiedEditorRef.current.setScrollPosition({
            scrollLeft: e.scrollLeft,
            scrollTop: e.scrollTop,
          });
        }
      });
    }

    return () => {
      disposable?.dispose();
    };
  }, [monaco, oldValue, newValue, language, viewMode, applyDiffDecorations]);

  return (
    <Card>
      <div style={{ height: "450px" }}>
        <BlockStack gap="400">
          <Box padding="400">
            <Select
              label="View Mode"
              options={[
                { label: "Split View", value: "split" },
                { label: "Inline View", value: "inline" },
              ]}
              onChange={handleViewModeChange}
              value={viewMode}
            />
          </Box>
          {viewMode === "split" ? (
            <div style={{ height: "350px" }}>
              <DiffEditor
                original={oldValue}
                modified={newValue}
                language={language}
                theme="vs-light"
                options={diffOptions}
                onMount={handleEditorDidMount}
                loading={<Box padding="400">Loading diff view...</Box>}
              />
            </div>
          ) : (
            <div style={{ height: "350px" }}>
              <DiffEditor
                original={oldValue}
                modified={newValue}
                language={language}
                theme="vs-light"
                options={diffOptions}
                onMount={handleEditorDidMount}
                loading={<Box padding="400">Loading diff view...</Box>}
              />
            </div>
          )}
        </BlockStack>
      </div>
    </Card>
  );
}

export default memo(DiffViewer);
