// app/routes/index.tsx
import { useState } from "react";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  Box,
  Layout,
  Spinner,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import ThemeSelector from "../components/ThemeSelector";
import DiffViewer from "../components/DiffViewer";
import type { Theme, DiffContents } from "../types/theme";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
}

export default function Index() {
  const navigation = useNavigation();
  const [diffContents, setDiffContents] = useState<DiffContents | null>(null);
  const [sourceTheme, setSourceTheme] = useState<Theme | null>(null);
  const [targetTheme, setTargetTheme] = useState<Theme | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [scannedFiles, setScannedFiles] = useState(0);
  const [diffedFiles, setDiffedFiles] = useState(0);
  const [currentStage, setCurrentStage] = useState<
    "idle" | "scanning" | "diffing"
  >("idle");
  const [currentFile, setCurrentFile] = useState<string>("");

  const comparing = navigation.state === "loading";

  const handleCompare = async () => {
    if (!sourceTheme || !targetTheme) {
      setError("Please select both themes to compare");
      return;
    }
    setLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFile(null);
    setTotalFiles(0);
    setScannedFiles(0);
    setDiffedFiles(0);
    setCurrentStage("scanning");
    setCurrentFile("");

    try {
      const sourceId = sourceTheme.id.split("/").pop();
      const targetId = targetTheme.id.split("/").pop();

      // First get total files count
      const countResponse = await fetch(
        `/api/scan?source=${sourceId}&target=${targetId}&mode=count`,
      );

      const countData = await countResponse.json();

      if (!countResponse.ok || countData.error) {
        throw new Error(countData.error || "Failed to get file count");
      }

      if (typeof countData.totalFileCount !== "number") {
        throw new Error("Invalid response from server: missing file count");
      }

      setTotalFiles(countData.totalFileCount);

      // Then start the comparison with progress
      const response = await fetch(
        `/api/scan?source=${sourceId}&target=${targetId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to compare themes");
      }

      const reader = response.body?.getReader();
      let finalData = null;

      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";

        const processProgressUpdate = (data: any) => {
          if (data.scannedFiles !== undefined) {
            setScannedFiles(data.scannedFiles);
          }
          if (data.diffedFiles !== undefined) {
            setDiffedFiles(data.diffedFiles);
          }
          if (data.currentFile) {
            setCurrentFile(data.currentFile);
          }
          if (data.stage) {
            setCurrentStage(data.stage);
          }
          if (data.done) {
            finalData = data;
            setCurrentStage("idle");
            setLoading(false);
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true }); // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                // Batch state updates for better performance
                processProgressUpdate(data);
              } catch (e) {
                console.error("Failed to parse progress update:", e);
              }
            }
          }
        }

        // Process any remaining data
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.done) {
              finalData = data;
              setCurrentStage("idle");
            }
          } catch (e) {
            console.error("Failed to parse final chunk:", e);
          }
        }
      }
      if (!finalData) {
        throw new Error("No final data received from server");
      }
      const data = finalData;

      // Set all the state updates at once to avoid re-renders
      const updates = () => {
        setFiles(data.files || []);
        setDiffContents(data.diffContents || {});
        setLoading(false);
        setCurrentStage("idle");
        if (data.files && data.files.length > 0) {
          setSelectedFile(data.files[0]); // Select the first file by default
        }
        if (data.error) {
          setError(data.error);
        }
      };
      updates(); // Save comparison to history (non-blocking)
      if (data && !data.error) {
        // Show the differences immediately
        const updates = () => {
          setFiles(data.files || []);
          setDiffContents(data.diffContents || {});
          setLoading(false);
          setCurrentStage("idle");
          if (data.files && data.files.length > 0) {
            setSelectedFile(data.files[0]); // Select the first file by default
          }
        };
        updates();

        // Save to history in the background
        fetch("/api/history", {
          method: "POST",
          body: JSON.stringify({
            sourceTheme,
            targetTheme,
            differences: data.differentFiles,
            files: data.files,
            diffContents: data.diffContents,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(console.error); // Handle any errors silently
      }
    } catch (err) {
      const updates = () => {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while comparing themes",
        );
        setCurrentStage("idle");
        setLoading(false);
        setDiffContents(null);
        setFiles([]);
      };
      updates();
    } finally {
      setCurrentFile("");
    }
  };

  return (
    <Page
      fullWidth
      title="Theme Comparison"
      backAction={{ content: "Products", url: "/app" }}
      primaryAction={{
        content: "Compare Themes",
        onAction: handleCompare,
        loading: loading || comparing,
        disabled: !sourceTheme || !targetTheme || loading || comparing,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Layout>
              <Layout.Section variant="oneHalf">
                <ThemeSelector
                  selectedTheme={sourceTheme}
                  onSelect={setSourceTheme}
                  type="source"
                />
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <ThemeSelector
                  selectedTheme={targetTheme}
                  onSelect={setTargetTheme}
                  type="target"
                />
              </Layout.Section>
            </Layout>
            {error && (
              <Card>
                <BlockStack gap="200">
                  <Text tone="critical" as="p">
                    {error}
                  </Text>
                </BlockStack>
              </Card>
            )}

            {!loading && totalFiles > 0 && (
              <Box background="bg-fill-active" padding="100">
                <Card>
                  <InlineStack
                    wrap={false}
                    gap="200"
                    align="start"
                    blockAlign="center"
                  >
                    <Text as="span" variant="bodyMd">
                      Scanned:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {totalFiles}
                    </Text>
                    /
                    <Text as="span" variant="bodySm" tone="success">
                      {scannedFiles} files
                    </Text>
                    <Text
                      as="span"
                      variant="bodySm"
                      tone={
                        diffContents &&
                        Object.values(diffContents).some((c) => c.isDifferent)
                          ? "critical"
                          : "success"
                      }
                    >
                      (found{" "}
                      {
                        Object.values(diffContents ?? {}).filter(
                          (c) => c.isDifferent,
                        ).length
                      }{" "}
                      difference file)
                    </Text>
                  </InlineStack>
                </Card>
              </Box>
            )}
            {loading && (
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Spinner size="large" />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h4">
                          {currentStage === "scanning"
                            ? "Scanning Theme Files"
                            : currentStage === "diffing"
                              ? "Analyzing Differences"
                              : "Preparing Comparison..."}
                        </Text>
                        {totalFiles > 0 && (
                          <Box background="bg-fill-active">
                            {/* Scanning Progress */}
                            <InlineStack
                              wrap={false}
                              align="center"
                              blockAlign="center"
                              gap="200"
                            >
                              <Text as="p" variant="bodyMd">
                                Scanned
                              </Text>
                              <Text as="p" variant="bodyMd">
                                {scannedFiles}/{totalFiles} files
                              </Text>

                              <Text as="p" variant="bodyLg">
                                (found {diffedFiles}/{totalFiles} files
                                difference)
                              </Text>
                            </InlineStack>
                            <div
                              style={{
                                width: "100%",
                                backgroundColor: "#f1f1f1",
                                borderRadius: "4px",
                                marginTop: "4px",
                              }}
                            >
                              <div
                                style={{
                                  width: `${(scannedFiles / totalFiles) * 100}%`,
                                  backgroundColor:
                                    currentStage === "scanning"
                                      ? "var(--p-action-primary)"
                                      : "var(--p-action-success)",
                                  height: "8px",
                                  borderRadius: "4px",
                                  transition: "width 0.3s ease-in-out",
                                }}
                              />
                            </div>
                            {/* Diffing Progress */}

                            {currentFile && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                Current file: {currentFile}
                              </Text>
                            )}
                          </Box>
                        )}
                      </BlockStack>
                    </div>
                  </BlockStack>
                </Box>
              </Card>
            )}

            {!loading && files.length > 0 && (
              <Layout>
                <Layout.Section variant="oneThird">
                  <Card>
                    <div
                      style={{
                        maxHeight: "450px",
                        minHeight: "450px",
                        overflowY: "scroll",
                      }}
                    >
                      <BlockStack gap="200">
                        {files.map((file) => (
                          <InlineStack
                            key={file}
                            align="space-between"
                            blockAlign="center"
                            gap="200"
                            wrap={false}
                          >
                            <div style={{ flexGrow: 1 }}>
                              <Button
                                onClick={() => setSelectedFile(file)}
                                variant={
                                  selectedFile === file
                                    ? "primary"
                                    : "secondary"
                                }
                                textAlign="left"
                                fullWidth
                              >
                                {file}
                              </Button>
                            </div>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </div>
                  </Card>
                </Layout.Section>

                <Layout.Section>
                  {selectedFile &&
                    diffContents &&
                    diffContents[selectedFile] && (
                      <DiffViewer
                        oldValue={diffContents[selectedFile].sourceContent}
                        newValue={diffContents[selectedFile].targetContent}
                        language={
                          selectedFile.endsWith(".json")
                            ? "json"
                            : selectedFile.endsWith(".js")
                              ? "javascript"
                              : selectedFile.endsWith(".liquid")
                                ? "liquid"
                                : "plaintext"
                        }
                      />
                    )}
                </Layout.Section>
              </Layout>
            )}
            {!loading && files.length === 0 && sourceTheme && targetTheme && (
              <Box background="bg-fill-active">
                <Card>
                  <BlockStack gap="200">
                    <Text as="p" alignment="center">
                      No differences found between the selected themes. click
                      compare theme
                    </Text>
                  </BlockStack>
                </Card>
              </Box>
            )}
            {!loading && !sourceTheme && !targetTheme && (
              <Box background="bg-fill-active">
                <Card>
                  <BlockStack gap="200">
                    <Text as="p" alignment="center">
                      Please select both source and target themes to start
                      comparison
                    </Text>
                  </BlockStack>
                </Card>
              </Box>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
