import { Card, Text, ProgressBar, BlockStack } from "@shopify/polaris";

export default function ScanProgress({
  scanning,
  progress,
}: {
  scanning: boolean;
  progress: { scanned: number; total: number; differences: number };
}) {
  const percent =
    progress.total > 0
      ? Math.round((progress.scanned / progress.total) * 100)
      : 0;

  return (
    <Card>
      <BlockStack>
        <Text variant="headingMd" as="h2">
          Scanning Files
        </Text>
        {scanning ? (
          <>
            <BlockStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Scanning files...
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {progress.scanned}/{progress.total > 0 ? progress.total : "?"}{" "}
                files
              </Text>
            </BlockStack>
            <ProgressBar progress={percent} size="small" />
          </>
        ) : (
          <Text as="span" variant="bodySm">
            Scanned {progress.scanned} of {progress.total} files
            {progress.differences > 0 ? (
              <Text as="span" fontWeight="medium">
                {" "}
                (Found {progress.differences} differences)
              </Text>
            ) : (
              <Text as="span"> (No differences found)</Text>
            )}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
