import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { Card, Text, Badge, BlockStack } from "@shopify/polaris";

// Define the type for a single diff tuple
type DiffTuple = [number, string];

// Define the loader return type
interface LoaderData {
  diffs: DiffTuple[];
}

// Update DiffViewer loader
export const loader: LoaderFunction = async ({ params, request }) => {
  const url = new URL(request.url);
  const sourceThemeId = url.searchParams.get("source");
  const targetThemeId = url.searchParams.get("target");

  const res = await fetch(
    `/api/compare?source=${sourceThemeId}&target=${targetThemeId}&file=${params.fileName}`,
  );

  if (!res.ok) {
    throw new Error("Failed to load diff");
  }

  return res.json();
};

export default function DiffViewer() {
  const { diffs } = useLoaderData() as LoaderData;

  return (
    <Card>
      <BlockStack>
        {diffs.map(([change, text], i) => {
          let color: "success" | "critical" | undefined;
          if (change === 1) color = "success";
          if (change === -1) color = "critical";

          return (
            <div key={i}>
              {text.split("\n").map((line, j) => (
                <Text
                  key={j}
                  as="span"
                  variant="bodySm"
                  fontWeight={change !== 0 ? "medium" : undefined}
                  tone={
                    change === 1
                      ? "success"
                      : change === -1
                        ? "critical"
                        : undefined
                  }
                  style={{
                    display: "block",
                    background:
                      change === 1
                        ? "#e3fcec"
                        : change === -1
                          ? "#fde3e1"
                          : undefined,
                    borderLeft:
                      change === 1
                        ? "4px solid #36b37e"
                        : change === -1
                          ? "4px solid #d72c0d"
                          : undefined,
                    padding: "4px 8px",
                  }}
                >
                  {line}
                </Text>
              ))}
            </div>
          );
        })}
      </BlockStack>
    </Card>
  );
}
