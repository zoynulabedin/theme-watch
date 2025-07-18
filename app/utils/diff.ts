import { diffLines } from 'diff';
import type { DiffContents } from '../types/theme';

export interface ThemeDiffResult {
  differences: number;
  files: string[];
  diffContents: DiffContents;
}

export async function getThemeDiff(sourceContent: string, targetContent: string): Promise<string[]> {
  const diffResult = diffLines(sourceContent, targetContent);
  return diffResult.map(part => 
    part.added ? `+ ${part.value}` :
    part.removed ? `- ${part.value}` :
    `  ${part.value}`
  );
}
