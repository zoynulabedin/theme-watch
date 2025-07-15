import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Helper to get all assets for a theme using direct fetch
async function getThemeAssets(
  shop: string,
  accessToken: string,
  themeId: number,
) {
  const res = await fetch(
    `https://${shop}/admin/api/2023-10/themes/${themeId}/assets.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) throw new Error("Failed to fetch assets");
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

  // Asset content can be in 'value' or 'attachment' (base64-encoded)
  return data.asset?.value || data.asset?.attachment || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate and get admin API client and session
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  const url = new URL(request.url);
  const sourceThemeId = url.searchParams.get("source") || "";
  const targetThemeId = url.searchParams.get("target") || "";
  if (!sourceThemeId || !targetThemeId) {
    return json({ error: "Missing theme IDs" }, { status: 400 });
  }

  // Fetch asset lists for both themes
  const [sourceAssets, targetAssets] = await Promise.all([
    getThemeAssets(shop, accessToken, Number(sourceThemeId)),
    getThemeAssets(shop, accessToken, Number(targetThemeId)),
  ]);

  // Find assets that exist in both themes (by key)
  const sourceMap = Object.fromEntries(
    sourceAssets.map((f: any) => [f.key, f]),
  );
  const targetMap = Object.fromEntries(
    targetAssets.map((f: any) => [f.key, f]),
  );
  const filesInBoth = Object.keys(sourceMap).filter((key) => key in targetMap);

  // Send early response with total files if requested (for live progress)
  if (url.searchParams.get("progressOnly") === "1") {
    return json({ totalFiles: filesInBoth.length });
  }

  // Compare asset contents
  const differentFiles: string[] = [];
  const diffContents: Record<
    string,
    { sourceContent?: string; targetContent?: string; error?: string }
  > = {};
  for (const key of filesInBoth) {
    try {
      const [sourceContent, targetContent] = await Promise.all([
        getAssetContent(shop, accessToken, Number(sourceThemeId), key + ""),
        getAssetContent(shop, accessToken, Number(targetThemeId), key + ""),
      ]);
      // Only push if both sides have the file (key matches) and code is different
      if (
        typeof sourceContent === "string" &&
        typeof targetContent === "string" &&
        sourceContent !== targetContent &&
        sourceContent.length > 0 &&
        targetContent.length > 0
      ) {
        differentFiles.push(key);
        diffContents[key] = { sourceContent, targetContent };
      }
    } catch (e) {
      // Record error for this file so frontend can show a message
      diffContents[key] = { error: "Failed to fetch file content" };
    }
  }

  return json({
    totalFiles: filesInBoth.length,
    differentFiles: differentFiles.length,
    files: differentFiles,
    allFiles: filesInBoth,
    diffContents,
  });
};
