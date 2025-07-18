-- CreateTable
CREATE TABLE "ThemeComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "sourceThemeId" TEXT NOT NULL,
    "targetThemeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "differences" INTEGER NOT NULL DEFAULT 0,
    "files" TEXT NOT NULL,
    CONSTRAINT "ThemeComparison_sourceThemeId_fkey" FOREIGN KEY ("sourceThemeId") REFERENCES "ThemeInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ThemeComparison_targetThemeId_fkey" FOREIGN KEY ("targetThemeId") REFERENCES "ThemeInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComparisonResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comparisonId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceContent" TEXT NOT NULL,
    "targetContent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComparisonResult_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ThemeComparison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThemeInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT
);
