import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { diff_match_patch, type Diff } from "diff-match-patch";

// Rate limiter implementation
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1 request per second to be safe
  private maxRetries = 3;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(task);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(
    task: () => Promise<T>,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await task();
    } catch (error: any) {
      if (error.status === 429 && retryCount < this.maxRetries) {
        const backoffTime = Math.pow(2, retryCount) * this.minRequestInterval;
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this.executeWithRetry(task, retryCount + 1);
      }
      throw error;
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeToWait = Math.max(
        0,
        this.minRequestInterval - (now - this.lastRequestTime),
      );
      if (timeToWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
      }

      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        await task();
      }
    }

    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

// Helper to get any file content from Shopify theme (not just assets)
async function getThemeFileContent(
  shop: string,
  accessToken: string,
  themeId: string,
  key: string,
): Promise<string | null> {
  return rateLimiter.enqueue(async () => {
    try {
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
        const errorText = await res.text();
        console.error(
          `Shopify API error for ${key} in theme ${themeId}:`,
          errorText,
        );
        throw { status: res.status, message: errorText };
      }

      const data = await res.json();
      return data.asset?.value || data.asset?.attachment || null;
    } catch (error) {
      console.error(
        `Failed to fetch asset ${key} from theme ${themeId}:`,
        error,
      );
      throw error;
    }
  });
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

  // Defensive: Only allow .js, .json, .liquid files
  if (!/[.](js|json|liquid)$/.test(filePath)) {
    return json(
      { error: "Only .js, .json, .liquid files are allowed" },
      { status: 400 },
    );
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

  // Professional: Normalize line endings and trim trailing whitespace
  const normSource = (sourceContentShopify || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "");
  const normTarget = (targetContentShopify || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "");

  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(normSource, normTarget);
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
    sourceContent: normSource,
    targetContent: normTarget,
    diffs: (diffs as Diff[]).map((diff) => [diff[0], diff[1]]),
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
