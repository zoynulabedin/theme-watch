import { useEffect, useState } from "react";
import { Card, Text, Spinner, BlockStack } from "@shopify/polaris";

interface DiffData {
  diffs: [number, string][];
  sourceContent: string;
  targetContent: string;
  stats: {
    additions: number;
    deletions: number;
    linesChanged: number;
  };
}

export default function DiffViewerWrapper({
  fileName,
  sourceTheme,
  targetTheme,
  split = false,
  showSummaryBarOnly = false,
  sourceContent,
  targetContent,
  error,
}: {
  fileName: string;
  sourceTheme: { id: string };
  targetTheme: { id: string };
  split?: boolean;
  showSummaryBarOnly?: boolean;
  sourceContent?: string;
  targetContent?: string;
  error?: string;
}) {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileName || error) return;
    setLoading(true);
    setInternalError(null);
    let url = `/api/compare?file=${encodeURIComponent(fileName)}`;
    if (
      typeof sourceContent === "string" ||
      typeof targetContent === "string"
    ) {
      url += `&sourceContent=${encodeURIComponent(sourceContent || "")}&targetContent=${encodeURIComponent(targetContent || "")}`;
    } else if (sourceTheme?.id && targetTheme?.id) {
      url += `&source=${sourceTheme.id}&target=${targetTheme.id}`;
    }
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load diff");
        return res.json();
      })
      .then((data) => setDiffData(data))
      .catch((e) => setInternalError(e.message))
      .finally(() => setLoading(false));
  }, [fileName, sourceTheme, targetTheme, sourceContent, targetContent, error]);

  if (error) {
    return (
      <Card>
        <Text as="span" tone="critical">
          {error}
        </Text>
      </Card>
    );
  }
  if (loading) return <Spinner />;
  if (internalError)
    return (
      <Text as="span" tone="critical">
        {internalError}
      </Text>
    );
  if (!diffData) return null;

  const summaryBar = (
    <Card>
      <BlockStack>
        <Text as="span" variant="bodySm" fontWeight="medium">
          {diffData.stats.linesChanged} lines modified with{" "}
          {diffData.stats.additions} additions and {diffData.stats.deletions}{" "}
          deletions
        </Text>
      </BlockStack>
    </Card>
  );

  if (showSummaryBarOnly) return summaryBar;

  if (split) {
    // Extract numeric theme IDs from Shopify GIDs
    const sourceThemeId = sourceTheme?.id?.split("/").pop();
    const targetThemeId = targetTheme?.id?.split("/").pop();

    const left: Array<{ line: string; type: "del" | "context" | null }> = [];
    const right: Array<{ line: string; type: "add" | "context" | null }> = [];
    diffData.diffs.forEach(([change, text]) => {
      const lines = text.split("\n");
      // Remove trailing empty line for display
      if (lines[lines.length - 1] === "") lines.pop();
      if (change === -1) {
        lines.forEach((line) => left.push({ line, type: "del" }));
        lines.forEach(() => right.push({ line: "", type: null }));
      } else if (change === 1) {
        lines.forEach(() => left.push({ line: "", type: null }));
        lines.forEach((line) => right.push({ line, type: "add" }));
      } else {
        lines.forEach((line) => {
          left.push({ line, type: "context" });
          right.push({ line, type: "context" });
        });
      }
    });
    return (
      <Card>
        <div
          style={{
            display: "flex",
            gap: 16,
            minHeight: "35vh",
            overflowY: "auto",
            maxHeight: "35vh",
          }}
        >
          <div>
            <div style={{ display: "block", marginBottom: 8 }}>
              <Text as="span" variant="headingSm">
                Source (Theme ID: {sourceThemeId})
              </Text>
            </div>
            {left.map((item, i) => (
              <span
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: 20,
                  background: item.type === "del" ? "#fde3e1" : undefined,
                  borderLeft:
                    item.type === "del" ? "4px solid #d72c0d" : undefined,
                  color: item.type === "del" ? "#d72c0d" : undefined,
                  fontWeight: item.type === "del" ? 600 : undefined,
                  padding: "4px 8px",
                  fontFamily: "monospace",
                  whiteSpace: "pre",
                }}
              >
                <span
                  style={{
                    width: 32,
                    textAlign: "right",
                    opacity: 0.6,
                    marginRight: 8,
                  }}
                >
                  {item.line !== "" ? i + 1 : ""}
                </span>
                {item.line || "\u00A0"}
              </span>
            ))}
          </div>
          <div>
            <div style={{ display: "block", marginBottom: 8 }}>
              <Text as="span" variant="headingSm">
                Target (Theme ID: {targetThemeId})
              </Text>
            </div>
            {right.map((item, i) => (
              <span
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: 20,
                  background: item.type === "add" ? "#e3fcec" : undefined,
                  borderLeft:
                    item.type === "add" ? "4px solid #36b37e" : undefined,
                  color: item.type === "add" ? "#008060" : undefined,
                  fontWeight: item.type === "add" ? 600 : undefined,
                  padding: "4px 8px",
                  fontFamily: "monospace",
                  whiteSpace: "pre",
                }}
              >
                <span
                  style={{
                    width: 32,
                    textAlign: "right",
                    opacity: 0.6,
                    marginRight: 8,
                  }}
                >
                  {item.line !== "" ? i + 1 : ""}
                </span>
                {item.line || "\u00A0"}
              </span>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Unified view: show only changed lines, color additions green, deletions red, with line numbers
  const sourceThemeId = sourceTheme?.id?.split("/").pop();
  const targetThemeId = targetTheme?.id?.split("/").pop();
  let unifiedLine = 1;
  return (
    <Card>
      <BlockStack>
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <Text as="span" variant="headingSm">
            Source (Theme ID: {sourceThemeId})
          </Text>
          <Text as="span" variant="headingSm">
            Target (Theme ID: {targetThemeId})
          </Text>
        </div>
        <div
          style={{ minHeight: "35vh", overflowY: "auto", maxHeight: "35vh" }}
        >
          {diffData.diffs.map(([change, text], i) => {
            const lines = text.split("\n");
            // Remove trailing empty line for display
            if (lines[lines.length - 1] === "") lines.pop();
            return lines.map((line, j) => {
              if (change === 0) return null; // skip context lines
              let bg, border, color, fontWeight;
              if (change === 1) {
                bg = "#e3fcec";
                border = "4px solid #36b37e";
                color = "#008060";
                fontWeight = 600;
              } else if (change === -1) {
                bg = "#fde3e1";
                border = "4px solid #d72c0d";
                color = "#d72c0d";
                fontWeight = 600;
              }
              return (
                <span
                  key={j}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: bg,
                    borderLeft: border,
                    color,
                    fontWeight,
                    padding: "4px 8px",
                    fontFamily: "monospace",
                    whiteSpace: "pre",
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      textAlign: "right",
                      opacity: 0.6,
                      marginRight: 8,
                    }}
                  >
                    {unifiedLine++}
                  </span>
                  {line}
                </span>
              );
            });
          })}
        </div>
      </BlockStack>
    </Card>
  );
}
