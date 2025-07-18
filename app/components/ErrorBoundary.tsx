import { useRouteError } from "@remix-run/react";
import { BlockStack, Card, Text, Layout, Page, Banner } from "@shopify/polaris";

interface ErrorResponse {
  status?: number;
  statusText?: string;
  message?: string;
  data?: any;
}

export function ErrorBoundary() {
  const error = useRouteError() as Error | ErrorResponse;

  const errorMessage =
    error instanceof Error
      ? error.message
      : error.message || error.statusText || "An unexpected error occurred";

  const errorDetails =
    process.env.NODE_ENV === "development"
      ? error instanceof Error
        ? error.stack
        : JSON.stringify(error.data || error, null, 2)
      : null;

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Banner tone="critical">
                <Text variant="headingLg" as="h1">
                  Error
                </Text>
                <Text as="p">{errorMessage}</Text>
              </Banner>

              {errorDetails && (
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h2">
                    Error Details
                  </Text>
                  <div
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "1rem",
                      borderRadius: "4px",
                      overflowX: "auto",
                    }}
                  >
                    <code
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "monospace",
                      }}
                    >
                      {errorDetails}
                    </code>
                  </div>
                </BlockStack>
              )}

              <Text as="p">
                Try refreshing the page or contact support if the problem
                persists.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
