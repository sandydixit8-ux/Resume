export type SearchStatusDto = {
  enabled: boolean;
  healthy: boolean;
  host: string;
  collection: string;
  documentCount?: number;
  message?: string;
};

export type ReindexResultDto = {
  indexed: number;
  skipped: number;
  status: SearchStatusDto;
};