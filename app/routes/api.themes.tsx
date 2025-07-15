import { authenticate } from "../shopify.server";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  const response = await admin.graphql(
    `#graphql
        query getTheme {
          themes(first: 50) {
            nodes {
              id
            name
            createdAt
            role
            }
          }
        }
      `,
  );

  const data = await response.json();

  let themes = (data?.data?.themes?.nodes || []).map((node: any) => ({
    id: node.id,
    name: node.name,
    date: node.createdAt,
    type: node.role === "MAIN" ? "source" : "target",
  }));
  if (type) {
    themes = themes.filter((theme: any) => theme.type === type);
  }

  return json(themes);
};
