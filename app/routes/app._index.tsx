import { useState, useEffect } from "react";
import ThemeSelector from "../components/ThemeSelector";
import FileList from "../components/FileList";
import DiffViewerWrapper from "../components/DiffViewerWrapper";
import ScanProgress from "../components/ScanProgress";
import {
  InlineStack,
  Button,
  BlockStack,
  Card,
  Text,
  InlineGrid,
  Page,
} from "@shopify/polaris";

export default function Index() {
  const [sourceTheme, setSourceTheme] = useState<any>(null);
  const [targetTheme, setTargetTheme] = useState<any>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [compareClicked, setCompareClicked] = useState(false);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("split");
  const [scanProgress, setScanProgress] = useState({
    scanned: 0,
    total: 0,
    differences: 0,
  });
  const [scanning, setScanning] = useState(false);
  const [diffContents, setDiffContents] = useState<
    Record<
      string,
      { sourceContent: string; targetContent: string; error?: string }
    >
  >({});

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (
      scanning &&
      scanProgress.total > 0 &&
      scanProgress.scanned < scanProgress.total
    ) {
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev.scanned < prev.total) {
            return { ...prev, scanned: prev.scanned + 1 };
          }
          return prev;
        });
      }, 100);
    }
    if (!scanning && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanning, scanProgress.total, scanProgress.scanned]);

  const handleCompare = async () => {
    setCompareClicked(true);
    setShowFiles(false);
    setSelectedFile(null);
    setScanning(true);
    setScanProgress({ scanned: 0, total: 0, differences: 0 });
    if (sourceTheme && targetTheme) {
      // Extract numeric theme IDs from Shopify GIDs
      const sourceId = sourceTheme.id.split("/").pop();
      const targetId = targetTheme.id.split("/").pop();
      // Fetch total files first for live progress
      const totalRes = await fetch(
        `/api/scan?source=${sourceId}&target=${targetId}&progressOnly=1`,
      );
      const totalData = await totalRes.json();
      setScanProgress((prev) => ({ ...prev, total: totalData.totalFiles }));
      // Now start the scan
      const scanRes = await fetch(
        `/api/scan?source=${sourceId}&target=${targetId}`,
      );
      const scanData = await scanRes.json();
      // scanData.files is the array of different file names
      setFiles([]);
      setDiffContents(scanData.diffContents || {});
      setScanProgress({
        scanned: scanData.totalFiles,
        total: scanData.totalFiles,
        differences: scanData.file,
      });
      setScanning(false);
      setShowFiles(true);
      // Gradually reveal files one by one ONLY if there are differences
      if (scanData.files && scanData.files.length > 0) {
        let i = 0;
        const revealInterval = setInterval(() => {
          setFiles((prev) => {
            if (i < scanData.files.length) {
              return [...prev, scanData.files[i++]];
            } else {
              clearInterval(revealInterval);
              return prev;
            }
          });
        }, 120); // Adjust delay as desired
      } else {
        setFiles([]); // Ensure no files are shown if there are no differences
      }
    }
  };

  // Calculate diff summary for selected file
  let diffSummary = null;
  // Show summary bar above the diff (additions/deletions/lines changed)
  const selectedFileError = selectedFile && diffContents[selectedFile]?.error;
  if (selectedFile && files.includes(selectedFile) && !selectedFileError) {
    diffSummary = (
      <DiffViewerWrapper
        fileName={selectedFile}
        sourceTheme={sourceTheme}
        targetTheme={targetTheme}
        split={false} // Use unified mode for summary, but only render summary bar
        showSummaryBarOnly={true}
        sourceContent={diffContents[selectedFile]?.sourceContent}
        targetContent={diffContents[selectedFile]?.targetContent}
      />
    );
  }

  return (
    <Page fullWidth title="Theme code diff checker">
      <BlockStack gap="400">
        <InlineGrid columns={3} gap="400" alignItems="end">
          <ThemeSelector
            selectedTheme={sourceTheme}
            onSelect={setSourceTheme}
            type="source"
          />
          <ThemeSelector
            selectedTheme={targetTheme}
            onSelect={setTargetTheme}
            type="target"
          />
          <Button
            variant="primary"
            onClick={handleCompare}
            disabled={!sourceTheme || !targetTheme}
          >
            Compare Themes
          </Button>
        </InlineGrid>

        {compareClicked && (
          <ScanProgress scanning={scanning} progress={scanProgress} />
        )}
        <InlineStack gap="200">
          <Button
            variant={diffMode === "unified" ? "primary" : "secondary"}
            onClick={() => setDiffMode("unified")}
            disabled={!selectedFile}
          >
            Unified
          </Button>
          <Button
            variant={diffMode === "split" ? "primary" : "secondary"}
            onClick={() => setDiffMode("split")}
            disabled={!selectedFile}
          >
            Split
          </Button>
          {selectedFile && <Button variant="secondary">Edit</Button>}
        </InlineStack>
        <InlineGrid gap="200" columns={["oneThird", "twoThirds"]}>
          {showFiles && (
            <FileList
              files={files}
              onSelect={setSelectedFile}
              sourceTheme={sourceTheme}
              targetTheme={targetTheme}
              setFiles={setFiles}
            />
          )}
          <BlockStack gap="200">
            {selectedFile && (
              <>
                {diffSummary}
                <DiffViewerWrapper
                  fileName={selectedFile}
                  sourceTheme={sourceTheme}
                  targetTheme={targetTheme}
                  split={diffMode === "split"}
                  sourceContent={diffContents[selectedFile]?.sourceContent}
                  targetContent={diffContents[selectedFile]?.targetContent}
                  error={diffContents[selectedFile]?.error}
                />
              </>
            )}
            {!selectedFile && showFiles && (
              <Card>
                <Text as="span" tone="subdued">
                  Select a file to view differences.
                </Text>
              </Card>
            )}
          </BlockStack>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
