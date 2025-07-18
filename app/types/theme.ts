export interface Theme {
  id: string;
  name: string;
  role: string;
  processing?: boolean;
  created_at?: string;
  updated_at?: string;
  theme_store_id?: number | null;
  previewable?: boolean;
  processing_count?: number;
}

export interface DiffContent {
  sourceContent: string;
  targetContent: string;
  isDifferent: boolean;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  differences: number;
}

export interface DiffContents {
  [key: string]: DiffContent;
}

export interface ThemeComparison {
  id: string;
  shop: string;
  sourceTheme: {
    id: string;
    name: string;
    role?: string;
  };
  targetTheme: {
    id: string;
    name: string;
    role?: string;
  };
  createdAt: string;
  differences: number;
  files: string[];
  results: Array<{
    id: string;
    fileName: string;
    sourceContent: string;
    targetContent: string;
    createdAt: string;
  }>;
}
