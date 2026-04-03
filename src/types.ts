export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  collectionCount?: number;
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  space_id: string;
  parent_id: string | null;
  created_at: string;
  bookmarkCount?: number;
  children?: Collection[];
}

export interface Tag {
  id: string;
  name: string;
}

export interface Domain {
  domain: string;
  count: number;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  cover_image_url: string;
  content_text: string;
  domain: string;
  images_json: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  tags: Tag[];
  collections?: Collection[]; // New: multi-collection support
}
