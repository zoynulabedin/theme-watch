import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { diffLines } from "diff";

// Helper to get all assets for a theme using direct fetch
async function getThemeAssets(
  shop: string,
  accessToken: string,
  themeId: number,
) {
  if (!shop) throw new Error("Missing shop domain for asset fetch");
  const res = await fetch(
    `https://${shop}/admin/api/2023-10/themes/${themeId}/assets.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    let msg = `Failed to fetch assets for theme ${themeId}`;
    try {
      const err = await res.json();
      if (err && err.errors) msg += `: ${JSON.stringify(err.errors)}`;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data.assets || [];
}

// Helper to get asset content using direct fetch
async function getAssetContent(
  shop: string,
  accessToken: string,
  themeId: number,
  key: string,
) {
  const res = await fetch(
    `https://${shop}/admin/api/2023-10/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) throw new Error(`Failed to fetch asset: ${key}`);
  const data = await res.json();
  return data.asset?.value || data.asset?.attachment || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate and get admin API client and session
    const { session } = await authenticate.admin(request);
    const shop: string = session.shop || "";
    const accessToken: string = session.accessToken || "";

    if (!shop || !accessToken) {
      return json(
        { error: "Authentication failed: Missing shop or access token" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const sourceThemeId = url.searchParams.get("source");
    const targetThemeId = url.searchParams.get("target");

    if (!sourceThemeId || !targetThemeId) {
      return json({ error: "Missing theme IDs" }, { status: 400 });
    }

    // Get both theme assets
    const [sourceAssets, targetAssets] = await Promise.all([
      getThemeAssets(shop, accessToken, Number(sourceThemeId)),
      getThemeAssets(shop, accessToken, Number(targetThemeId)),
    ]);

    const sourceMap = Object.fromEntries(
      sourceAssets.map((f: any) => [f.key, f]),
    );
    const targetMap = Object.fromEntries(
      targetAssets.map((f: any) => [f.key, f]),
    );
    const filesInBoth = Object.keys(sourceMap).filter(
      (key) => key in targetMap,
    );

    const allowedExtensions = [".js", ".json", ".liquid"];
    const filteredFilesInBoth = filesInBoth.filter((filename) =>
      allowedExtensions.some((ext) => filename.endsWith(ext)),
    );

    // If mode is count, just return the total file count
    if (mode === "count") {
      return json({ totalFileCount: filteredFilesInBoth.length });
    }

    // Regular comparison mode with streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const differentFiles: string[] = [];
          const diffContents: Record<string, any> = {};
          let scanned = 0;
          let diffed = 0;

          // Send initial data
          controller.enqueue(
            JSON.stringify({
              totalFiles: filteredFilesInBoth.length,
              scannedFiles: 0,
              stage: "scanning",
            }) + "\n",
          );

          // Process each file
          for (const key of filteredFilesInBoth) {
            try {
              // First scanning phase - only send updates every 5 files
              if (scanned % 5 === 0) {
                controller.enqueue(
                  JSON.stringify({
                    stage: "scanning",
                    currentFile: key,
                    scannedFiles: scanned,
                  }) + "\n",
                );
              }

              const [sourceContent, targetContent] = await Promise.all([
                getAssetContent(shop, accessToken, Number(sourceThemeId), key),
                getAssetContent(shop, accessToken, Number(targetThemeId), key),
              ]);

              scanned++;
              const diffResult = diffLines(sourceContent, targetContent);
              const isDifferent = diffResult.some(
                (part: any) => part.added || part.removed,
              );
              if (isDifferent && sourceContent && targetContent) {
                differentFiles.push(key);
                diffContents[key] = {
                  sourceContent,
                  targetContent,
                  diffResult: diffResult.filter(
                    (part) => part.added || part.removed,
                  ),
                  isDifferent: true,
                };
              }

              diffed++;

              // Only send progress updates every 5 files or when it's a different file
              if (diffed % 5 === 0 || isDifferent) {
                controller.enqueue(
                  JSON.stringify({
                    stage: "diffing",
                    scannedFiles: scanned,
                    diffedFiles: differentFiles.length,
                    currentFile: key,
                    isDifferent,
                  }) + "\n",
                );
              }
            } catch (e) {
              scanned++;
              controller.enqueue(
                JSON.stringify({
                  scannedFiles: scanned,
                  error: `Error processing ${key}: ${e instanceof Error ? e.message : "Unknown error"}`,
                }) + "\n",
              );
            }
          } // Send final data with complete status
          controller.enqueue(
            JSON.stringify({
              files: differentFiles,
              diffContents,
              totalFiles: filteredFilesInBoth.length,
              scannedFiles: scanned,
              diffedFiles: differentFiles.length,
              stage: "idle",
              done: true,
              currentFile: "",
            }) + "\n",
          );

          // Close the stream immediately after sending final data
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
};
