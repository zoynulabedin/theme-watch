import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const comparisons = await prisma.themeComparison.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      results: {
        select: {
          fileName: true,
          id: true,
          createdAt: true,
        },
      },
    },
  });

  return json(comparisons);
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method === "POST") {
    const data = await request.json();
    const { sourceTheme, targetTheme, differences, files, diffContents } = data;

    const comparison = await prisma.themeComparison.create({
      data: {
        shop,
        sourceTheme: {
          create: {
            id: sourceTheme.id,
            name: sourceTheme.name,
            role: sourceTheme.type,
          },
        },
        targetTheme: {
          create: {
            id: targetTheme.id,
            name: targetTheme.name,
            role: targetTheme.type,
          },
        },
        differences,
        files,
        results: {
          create: Object.entries(diffContents).map(
            ([fileName, content]: [string, any]) => ({
              fileName,
              sourceContent: content.sourceContent,
              targetContent: content.targetContent,
            }),
          ),
        },
      },
      include: {
        results: true,
      },
    });

    return json(comparison);
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ error: "Missing comparison ID" }, { status: 400 });
    }

    await prisma.comparisonResult.deleteMany({
      where: { comparisonId: id },
    });

    await prisma.themeComparison.delete({
      where: { id },
    });

    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
