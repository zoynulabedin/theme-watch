import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { diff_match_patch } from "diff-match-patch";

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

  return json(await res.json());
};

export default function DiffViewer() {
  const { diffs } = useLoaderData() as LoaderData;

  return (
    <div className="diff-viewer font-mono text-sm">
      {diffs.map(([change, text], i) => {
        let bgClass = "";
        if (change === 1) bgClass = "bg-green-100 border-l-4 border-green-500";
        if (change === -1) bgClass = "bg-red-100 border-l-4 border-red-500";

        return (
          <div
            key={i}
            className={`p-2 ${bgClass} ${change !== 0 ? "font-medium" : ""}`}
          >
            {text.split("\n").map((line, j) => (
              <div key={j} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
