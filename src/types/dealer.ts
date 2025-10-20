// src/types/dealer.ts
export interface DealerConfig {
  slug: string;
  name: string;
  code: string;
  isActive: boolean;
  powerbiUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealerConfigs {
  [slug: string]: DealerConfig;
}