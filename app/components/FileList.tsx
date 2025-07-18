import { useEffect } from "react";
import { Card, ResourceList, Text, Box } from "@shopify/polaris";

interface FileListProps {
  files: string[];
  onSelect: (file: string) => void;
  sourceTheme?: { id: string };
  targetTheme?: { id: string };
  setFiles?: (files: string[]) => void;
}

export default function FileList({
  files,
  onSelect,
  sourceTheme,
  targetTheme,
  setFiles,
}: FileListProps) {
  useEffect(() => {
    if (sourceTheme && targetTheme && setFiles) {
      fetch(`/api/scan?source=${sourceTheme.id}&target=${targetTheme.id}`)
        .then((res) => res.json())
        .then((data) => setFiles(data.files));
    }
  }, [sourceTheme, targetTheme, setFiles]);

  return (
    <Card>
      <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
        {files.length > 0 ? (
          <ResourceList
            resourceName={{ singular: "file", plural: "files" }}
            items={files.map((file) => ({ id: file, name: file }))}
            renderItem={({ id, name }) => (
              <ResourceList.Item
                id={id}
                accessibilityLabel={`View ${name}`}
                onClick={() => onSelect(name)}
              >
                <Text variant="bodySm" fontWeight="medium" as="span">
                  {name}
                </Text>
              </ResourceList.Item>
            )}
          />
        ) : (
          <Box background="bg-surface-secondary">
            <Text as="span" alignment="center" tone="subdued">
              No differences found or select themes to compare
            </Text>
          </Box>
        )}
      </div>
    </Card>
  );
}
