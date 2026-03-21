export interface BookmarkData {
  id: string;
  url: string;
  title: string;
  description?: string;
  domain?: string;
  content_text?: string;
}

export interface CategorizationResult {
  categoryId?: string;
  newCategoryName?: string;
  parentCategoryId?: string;
  tags: string[];
}

export interface LLMConfig {
  enabled: boolean;
  provider: 'openrouter';
  apiKey: string;
  model: string;
  autoCategorizeOnAdd: boolean;
  fallbackToLocal: boolean;
}

export interface LocalHeuristicsConfig {
  enabled: boolean;
  domainCategoryRules: Record<string, string>; // domain -> categoryName
}

export interface ICategorizationStrategy {
  categorize(data: BookmarkData): Promise<CategorizationResult>;
  testConnection(): Promise<boolean>;
  getName(): string;
}

export interface CategorizationServiceResult {
  success: boolean;
  source: 'llm' | 'local' | null;
  categoryId?: string;
  tags: string[];
  error?: string;
}
