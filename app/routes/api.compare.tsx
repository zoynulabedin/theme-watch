import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { diff_match_patch, type Diff } from "diff-match-patch";

// Helper to get any file content from Shopify theme (not just assets)
async function getThemeFileContent(
  shop: string,
  accessToken: string,
  themeId: string,
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
  if (!res.ok) {
    // Log the error response for debugging
    const errorText = await res.text();
    console.error(
      `Shopify API error for ${key} in theme ${themeId}:`,
      errorText,
    );
    return null;
  }
  const data = await res.json();
  return data.asset?.value || data.asset?.attachment || "";
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  // If both contents are provided as query params, compare directly
  const sourceContent = url.searchParams.get("sourceContent");
  const targetContent = url.searchParams.get("targetContent");
  if (typeof sourceContent === "string" && typeof targetContent === "string") {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(sourceContent, targetContent);
    dmp.diff_cleanupSemantic(diffs);
    let additions = 0;
    let deletions = 0;
    (diffs as Diff[]).forEach((diff) => {
      const [change, text] = diff;
      if (change === 1) additions += text.split("\n").length - 1;
      else if (change === -1) deletions += text.split("\n").length - 1;
    });
    const linesChanged = additions + deletions;
    return json({
      sourceContent,
      targetContent,
      diffs: (diffs as Diff[]).map((diff) => [
        diff[0],
        diff[1].replace(/\r\n/g, "\n"),
      ]),
      stats: { additions, deletions, linesChanged },
    });
  }

  // Otherwise, fetch from Shopify as before
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  const sourceThemeId = url.searchParams.get("source");
  const targetThemeId = url.searchParams.get("target");
  const filePath = url.searchParams.get("file");
  if (!sourceThemeId || !targetThemeId || !filePath) {
    return json({ error: "Missing parameters" }, { status: 400 });
  }
  // Fetch file content from both themes using the file path as-is
  let [sourceContentShopify, targetContentShopify] = await Promise.all([
    getThemeFileContent(
      shop,
      String(accessToken),
      String(sourceThemeId),
      String(filePath),
    ),
    getThemeFileContent(
      shop,
      String(accessToken),
      String(targetThemeId),
      String(filePath),
    ),
  ]);

  if (sourceContentShopify == null && targetContentShopify == null) {
    return json(
      { error: `File '${filePath}' not found in either theme` },
      { status: 404 },
    );
  }
  if (sourceContentShopify == null) sourceContentShopify = "";
  if (targetContentShopify == null) targetContentShopify = "";

  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(
    sourceContentShopify || "",
    targetContentShopify || "",
  );
  dmp.diff_cleanupSemantic(diffs);

  let additions = 0;
  let deletions = 0;
  (diffs as Diff[]).forEach((diff) => {
    const [change, text] = diff;
    if (change === 1) additions += text.split("\n").length - 1;
    else if (change === -1) deletions += text.split("\n").length - 1;
  });
  const linesChanged = additions + deletions;

  return json({
    sourceContent: sourceContentShopify || "",
    targetContent: targetContentShopify || "",
    diffs: (diffs as Diff[]).map((diff) => [
      diff[0],
      diff[1].replace(/\r\n/g, "\n"),
    ]),
    stats: { additions, deletions, linesChanged },
  });
};

export const action: ActionFunction = async ({ request }) => {
  // Also support direct content diff via POST body
  const body = await request.json().catch(() => null);
  if (
    body &&
    typeof body.sourceContent === "string" &&
    typeof body.targetContent === "string"
  ) {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(body.sourceContent, body.targetContent);
    dmp.diff_cleanupSemantic(diffs);
    let additions = 0;
    let deletions = 0;
    (diffs as Diff[]).forEach((diff) => {
      const [change, text] = diff;
      if (change === 1) additions += text.split("\n").length - 1;
      else if (change === -1) deletions += text.split("\n").length - 1;
    });
    const linesChanged = additions + deletions;
    return json({
      sourceContent: body.sourceContent,
      targetContent: body.targetContent,
      diffs: (diffs as Diff[]).map((diff) => [
        diff[0],
        diff[1].replace(/\r\n/g, "\n"),
      ]),
      stats: { additions, deletions, linesChanged },
    });
  }

  // Fallback: log and return success
  const { sourceThemeId, targetThemeId, filePath, content } = body || {};
  console.log("Saving changes:", {
    sourceThemeId,
    targetThemeId,
    filePath,
    content,
  });

  return json({ success: true });
};
