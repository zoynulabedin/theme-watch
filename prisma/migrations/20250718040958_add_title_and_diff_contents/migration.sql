/*
  Warnings:

  - Added the required column `diffContents` to the `ThemeComparison` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `ThemeComparison` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ThemeComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceThemeId" TEXT NOT NULL,
    "targetThemeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "differences" INTEGER NOT NULL DEFAULT 0,
    "files" TEXT NOT NULL,
    "diffContents" TEXT NOT NULL,
    CONSTRAINT "ThemeComparison_sourceThemeId_fkey" FOREIGN KEY ("sourceThemeId") REFERENCES "ThemeInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThemeComparison_targetThemeId_fkey" FOREIGN KEY ("targetThemeId") REFERENCES "ThemeInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ThemeComparison" ("createdAt", "differences", "files", "id", "shop", "sourceThemeId", "targetThemeId") SELECT "createdAt", "differences", "files", "id", "shop", "sourceThemeId", "targetThemeId" FROM "ThemeComparison";
DROP TABLE "ThemeComparison";
ALTER TABLE "new_ThemeComparison" RENAME TO "ThemeComparison";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
