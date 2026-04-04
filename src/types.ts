export interface Space {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string;
  collectionCount?: number;
}

export interface Collection {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  space_id: string;
  parent_id: string | null;
  created_at: string;
  bookmarkCount?: number;
  children?: Collection[];
}

export interface SpaceWithCollections extends Space {
  collections: Collection[];
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
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  content_text: string | null;
  category_id: string | null;
  domain: string | null;
  images_json: string | null;
  category_name?: string | null;
  category_color?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: 0 | 1;
  tags: Tag[];
  collections?: Collection[];
}
