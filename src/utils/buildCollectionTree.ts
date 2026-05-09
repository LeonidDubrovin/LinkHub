import { Collection } from "../types";

export function buildCollectionTree(
  items: Collection[],
  parentId: string | null = null,
  decorate?: (item: Collection) => Partial<Collection>
): Collection[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({
      ...item,
      ...(decorate ? decorate(item) : {}),
      children: buildCollectionTree(items, item.id, decorate),
    }));
}
