import invariant from "tiny-invariant";

import type { Instruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { ElementDragPayload } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";

const VALID_DRAGGABLE_TYPES: BaseTreeItem["type"][] = ["attribute", "group"];

export const isDraggableItem = (item: BaseTreeItem) =>
  VALID_DRAGGABLE_TYPES.includes(item.type);

export interface BaseTreeItem extends Record<string | symbol, unknown> {
  id: string;
  children: TreeItem[];
  open?: boolean;
  treeRole?: "root";
  type: "group" | "attribute" | "footer";
}

interface GroupTreeItem extends BaseTreeItem {
  type: "group";
}

interface AttributeTreeItem extends BaseTreeItem {
  type: "attribute";
  data: {
    attribute: TreeAttributeData;
  };
}

interface FooterTreeItem extends BaseTreeItem {
  type: "footer";
  data: {
    actions: TreeFooterActions;
  };
}

// export type TreeItemData = {
//   attribute: TreeAttributeData;
// };

type TreeAttributeData = {
  name: string;
  value: string;
  operator: string;
};

type TreeFooterActions = {
  onClick: (ev: any) => void;
  onFocus: (ev: any) => void;
};

export type TreeItem = GroupTreeItem | AttributeTreeItem | FooterTreeItem;

export type TreeState = {
  lastAction: TreeAction | null;
  data: TreeItem[];
};

export function getInitialTreeState(): TreeState {
  return { data: getInitialData(), lastAction: null };
}

export function getInitialData(): TreeItem[] {
  return [
    {
      id: "1",
      open: true,
      type: "group",
      treeRole: "root",
      children: [
        {
          id: "1.3",
          open: true,
          type: "group",
          children: [
            {
              id: "1.3.1",
              children: [
                {
                  id: "1.3.9",
                  children: [
                    {
                      id: "1.3.32",
                      children: [
                        {
                          id: "1.3.211",
                          children: [],
                          type: "attribute",
                          data: {
                            attribute: {
                              name: "attribute 1",
                              value: "value 1",
                              operator: "=",
                            },
                          },
                        },
                      ],
                      type: "attribute",
                      data: {
                        attribute: {
                          name: "attribute 1",
                          value: "value 1",
                          operator: "=",
                        },
                      },
                    },
                  ],
                  type: "attribute",
                  data: {
                    attribute: {
                      name: "attribute 1",
                      value: "value 1",
                      operator: "=",
                    },
                  },
                },
              ],
              type: "attribute",
              data: {
                attribute: {
                  name: "attribute 1",
                  value: "value 1",
                  operator: "=",
                },
              },
            },
            {
              id: "1.3.2",
              type: "attribute",
              children: [],
              data: {
                attribute: {
                  name: "attribute 2",
                  value: "value 2",
                  operator: "=",
                },
              },
            },
          ],
        },
        {
          id: "1.4",
          children: [],
          type: "attribute",
          data: {
            attribute: {
              name: "attribute 3",
              value: "value 3",
              operator: "=",
            },
          },
        },
      ],
    },
  ];
}

export type TreeAction =
  | {
      type: "instruction";
      instruction: Instruction;
      itemId: string;
      targetId: string;
    }
  | {
      type: "toggle";
      itemId: string;
    }
  | {
      type: "expand";
      itemId: string;
    }
  | {
      type: "collapse";
      itemId: string;
    }
  | { type: "modal-move"; itemId: string; targetId: string; index: number };

export const tree = {
  remove(data: TreeItem[], id: string): TreeItem[] {
    return data
      .filter((item) => item.id !== id)
      .map((item) => {
        if (tree.hasChildren(item)) {
          return {
            ...item,
            children: tree.remove(item.children, id),
          };
        }
        return item;
      });
  },
  insertBefore(
    data: TreeItem[],
    targetId: string,
    newItem: TreeItem
  ): TreeItem[] {
    return data.flatMap((item) => {
      if (item.id === targetId) {
        return [newItem, item];
      }
      if (tree.hasChildren(item)) {
        return {
          ...item,
          children: tree.insertBefore(item.children, targetId, newItem),
        };
      }
      return item;
    });
  },
  insertAfter(
    data: TreeItem[],
    targetId: string,
    newItem: TreeItem
  ): TreeItem[] {
    return data.flatMap((item) => {
      if (item.id === targetId) {
        return [item, newItem];
      }

      if (tree.hasChildren(item)) {
        return {
          ...item,
          children: tree.insertAfter(item.children, targetId, newItem),
        };
      }

      return item;
    });
  },
  insertChild(
    data: TreeItem[],
    targetId: string,
    newItem: TreeItem
  ): TreeItem[] {
    return data.flatMap((item) => {
      if (item.id === targetId) {
        // already a parent: add as first child
        return {
          ...item,
          // opening item so you can see where item landed
          open: true,
          children: [newItem, ...item.children],
        };
      }

      if (!tree.hasChildren(item)) {
        return item;
      }

      return {
        ...item,
        children: tree.insertChild(item.children, targetId, newItem),
      };
    });
  },
  find(data: TreeItem[], itemId: string): TreeItem | undefined {
    for (const item of data) {
      if (item.id === itemId) {
        return item;
      }

      if (tree.hasChildren(item)) {
        const result = tree.find(item.children, itemId);
        if (result) {
          return result;
        }
      }
    }
  },
  getPathToItem({
    current,
    targetId,
    parentIds = [],
  }: {
    current: TreeItem[];
    targetId: string;
    parentIds?: string[];
  }): string[] | undefined {
    for (const item of current) {
      if (item.id === targetId) {
        return parentIds;
      }
      const nested = tree.getPathToItem({
        current: item.children,
        targetId: targetId,
        parentIds: [...parentIds, item.id],
      });
      if (nested) {
        return nested;
      }
    }
  },
  hasChildren(item: TreeItem): boolean {
    return item.children.length > 0;
  },
};

export function treeStateReducer(
  state: TreeState,
  action: TreeAction
): TreeState {
  return {
    data: dataReducer(state.data, action),
    lastAction: action,
  };
}

const dataReducer = (data: TreeItem[], action: TreeAction) => {
  console.log("action", action);

  const item = tree.find(data, action.itemId);
  if (!item) {
    return data;
  }

  if (action.type === "instruction") {
    const instruction = action.instruction;

    if (instruction.type === "reparent") {
      const path = tree.getPathToItem({
        current: data,
        targetId: action.targetId,
      });
      invariant(path);
      const desiredId = path[instruction.desiredLevel];
      let result = tree.remove(data, action.itemId);
      result = tree.insertAfter(result, desiredId, item);
      return result;
    }

    // the rest of the actions require you to drop on something else
    if (action.itemId === action.targetId) {
      return data;
    }

    if (instruction.type === "reorder-above") {
      let result = tree.remove(data, action.itemId);
      result = tree.insertBefore(result, action.targetId, item);
      return result;
    }

    if (instruction.type === "reorder-below") {
      let result = tree.remove(data, action.itemId);
      result = tree.insertAfter(result, action.targetId, item);
      return result;
    }

    if (instruction.type === "make-child") {
      let result = tree.remove(data, action.itemId);
      result = tree.insertChild(result, action.targetId, item);
      return result;
    }

    console.warn("TODO: action not implemented", instruction);

    return data;
  }

  function toggle(item: TreeItem): TreeItem {
    if (!tree.hasChildren(item)) {
      return item;
    }

    if (item.id === action.itemId) {
      return { ...item, open: !item?.open };
    }

    return { ...item, children: item.children.map(toggle) };
  }

  if (action.type === "toggle") {
    return data.map(toggle);
  }

  if (action.type === "expand") {
    if (tree.hasChildren(item) && !item?.open) {
      return data.map(toggle);
    }
    return data;
  }

  if (action.type === "collapse") {
    if (tree.hasChildren(item) && item?.open) {
      return data.map(toggle);
    }
    return data;
  }

  if (action.type === "modal-move") {
    let result = tree.remove(data, item.id);

    const siblingItems = getChildItems(result, action.targetId);

    if (siblingItems.length === 0) {
      if (action.targetId === "") {
        /**
         * If the target is the root level, and there are no siblings, then
         * the item is the only thing in the root level.
         */
        result = [item];
      } else {
        /**
         * Otherwise for deeper levels that have no children, we need to
         * use `insertChild` instead of inserting relative to a sibling.
         */
        result = tree.insertChild(result, action.targetId, item);
      }
    } else if (action.index === siblingItems.length) {
      const relativeTo = siblingItems[siblingItems.length - 1];
      /**
       * If the position selected is the end, we insert after the last item.
       */
      result = tree.insertAfter(result, relativeTo.id, item);
    } else {
      const relativeTo = siblingItems[action.index];
      /**
       * Otherwise we insert before the existing item in the given position.
       * This results in the new item being in that position.
       */
      result = tree.insertBefore(result, relativeTo.id, item);
    }

    return result;
  }

  return data;
};

function getChildItems(data: TreeItem[], targetId: string) {
  /**
   * An empty string is representing the root
   */
  if (targetId === "") {
    return data;
  }

  const targetItem = tree.find(data, targetId);
  invariant(targetItem);

  return targetItem.children;
}

export interface DraggingSourceData {
  draggingItem: TreeItem;
  draggingUniqueContextId: Symbol;
  wasOpenOnDragStart: boolean;
  level: number;
  index: number;
}

export interface DroppingTargetData {
  dropTargetWithInstruction: TreeItem;
  uniqueContextId: Symbol;
  level: number;
  index: number;
}

export function getDraggingSourceData(
  source: ElementDragPayload
): DraggingSourceData {
  const {
    draggingItem,
    draggingUniqueContextId,
    index,
    level,
    wasOpenOnDragStart,
  } = source.data as unknown as DraggingSourceData;
  return {
    draggingItem,
    draggingUniqueContextId,
    wasOpenOnDragStart,
    index,
    level,
  };
}
