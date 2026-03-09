export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  created_at: string;
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
  category_id: string;
  domain: string;
  images_json: string | null;
  category_name?: string;
  category_color?: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  tags: Tag[];
}
