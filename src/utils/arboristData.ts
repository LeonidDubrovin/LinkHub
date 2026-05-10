import { Collection, Space } from "../types";
import { buildCollectionTree } from "./buildCollectionTree";

export interface ArboristNodeData {
  id: string;
  name: string;
  icon: string;
  color: string;
  space_id: string;
  bookmarkCount: number;
  isGroup: boolean;
  children?: ArboristNodeData[];
}

function transformCollection(coll: Collection): ArboristNodeData {
  return {
    id: coll.id,
    name: coll.name,
    icon: coll.icon || "Folder",
    color: coll.color,
    space_id: coll.space_id,
    bookmarkCount: coll.bookmarkCount ?? 0,
    isGroup: false,
    ...(coll.children && coll.children.length > 0
      ? { children: coll.children.map((c) => transformCollection(c)) }
      : {}),
  };
}

export function transformToArboristData(
  spaces: Space[],
  collections: Collection[]
): ArboristNodeData[] {
  const sortedSpaces = [...spaces].sort((a, b) => {
    if (a.id === "inbox-space") return -1;
    if (b.id === "inbox-space") return 1;
    return a.name.localeCompare(b.name);
  });

  return sortedSpaces
    .filter((space) => space.name !== "Library")
    .map((space) => ({
      id: `group:${space.id}`,
      name: space.name,
      icon: space.icon || "Folder",
      color: space.color || "#6b7280",
      space_id: space.id,
      bookmarkCount: 0,
      isGroup: true,
      children: buildCollectionTree(
        collections.filter((c) => c.space_id === space.id),
        null
      ).map((coll) => transformCollection(coll)),
    }));
}
