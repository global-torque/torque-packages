export type FilerId = number | string;

export type FilerAccess = 'private' | 'public';

export interface IFilerItemMetaData {
  big?: string;
  small?: string;
  medium?: string;
  size?: number | string;
  [key: string]: unknown;
}

export interface IFilerItem {
  filename?: string;
  original_filename?: string;
  id?: FilerId;
  meta_data?: IFilerItemMetaData;
  mime?: string;
  name?: string;
  'object-data'?: string;
  'object-id'?: FilerId;
  'object-name'?: string;
  'object-type'?: string;
  bucket_path?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
  user_id?: FilerId;
  type?: string;
  entities?: Record<string, IFilerItem>;
  [key: string]: unknown;
}

export interface FilerObjectTree {
  entities: Record<string, IFilerItem>;
}

export interface FilerObjectPath {
  objectId: FilerId;
  objectName: string;
}

export interface IPostSignurlResponse {
  url?: string;
  file_id?: FilerId;
  meta?: {
    id?: FilerId;
  };
}

export interface FilerUploadResult {
  fileId: number;
}

export interface FilerNotificationFields {
  type?: string;
  object_id?: FilerId;
  source_file_id?: FilerId;
  [key: string]: unknown;
}
