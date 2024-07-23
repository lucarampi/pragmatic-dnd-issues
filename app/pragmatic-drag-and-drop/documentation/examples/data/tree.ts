import invariant from "tiny-invariant";

import type { Instruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { ElementDragPayload } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";

import { produce } from "immer";
import { nanoid } from "nanoid";

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

export interface AttributeTreeItem extends BaseTreeItem {
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

export type TreeItemData = {
  attribute: TreeAttributeData;
};

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
      force?: boolean;
    }
  | {
      type: "expand";
      itemId: string;
      force?: boolean;
    }
  | {
      type: "collapse";
      itemId: string;
      force?: boolean;
    }
  | {
      type: "attribute-data-update";
      itemId: string;
      attributeData?: Partial<AttributeTreeItem["data"]["attribute"]>;
    }
  | {
      type: "add-group";
      targetId: string;
      newGroup?: GroupTreeItem;
    }
  | {
      type: "add-attribute";
      targetId: string;
      newAttribute?: AttributeTreeItem;
    }
  | { type: "modal-move"; itemId: string; targetId: string; index: number };

export const treeHelper = {
  remove(data: TreeItem[], id: string): TreeItem[] {
    return data
      .filter((item) => item.id !== id)
      .map((item) => {
        if (treeHelper.hasChildren(item)) {
          return {
            ...item,
            children: treeHelper.remove(item.children, id),
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
      if (treeHelper.hasChildren(item)) {
        return {
          ...item,
          children: treeHelper.insertBefore(item.children, targetId, newItem),
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

      if (treeHelper.hasChildren(item)) {
        return {
          ...item,
          children: treeHelper.insertAfter(item.children, targetId, newItem),
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

      if (!treeHelper.hasChildren(item)) {
        return item;
      }

      return {
        ...item,
        children: treeHelper.insertChild(item.children, targetId, newItem),
      };
    });
  },
  find(data: TreeItem[], itemId: string): TreeItem | undefined {
    for (const item of data) {
      if (item.id === itemId) {
        return item;
      }

      if (treeHelper.hasChildren(item)) {
        const result = treeHelper.find(item.children, itemId);
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
      const nested = treeHelper.getPathToItem({
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
  updateAttributeData(
    tree: TreeItem[],
    itemId: string,
    attributeData: TreeItemData["attribute"]
  ): TreeItem[] {
    return tree.map((item) => {
      const isAttribute = item.type === "attribute";
      if (item.id === itemId && isAttribute) {
        return {
          ...item,
          data: {
            attribute: { ...attributeData },
          },
        };
      }

      if (treeHelper.hasChildren(item)) {
        return {
          ...item,
          children: treeHelper.updateAttributeData(
            item.children,
            itemId,
            attributeData
          ),
        };
      }
      return item;
    });
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

const dataReducer = (tree: TreeItem[], action: TreeAction) => {
  console.log("action", action);

  if (action.type === "add-group") {
    const { targetId, newGroup } = action;
    let groupToAdd = newGroup;

    if (!groupToAdd) {
      groupToAdd = {
        id: nanoid(),
        children: [],
        type: "group",
        open: true,
      };
    }
    return treeHelper.insertChild(tree, targetId, groupToAdd);
  }

  if (action.type === "add-attribute") {
    const { targetId, newAttribute: newGroup } = action;
    let attributeToAdd = newGroup;

    if (!attributeToAdd) {
      attributeToAdd = {
        id: nanoid(),
        children: [],
        type: "attribute",
        data: {
          attribute: {
            name: "New Attribute",
            value: "",
            operator: "=",
          },
        },
      };
    }
    return treeHelper.insertChild(tree, targetId, attributeToAdd);
  }

  invariant(action.itemId, "'itemId' is required for this action!");

  const item = treeHelper.find(tree, action.itemId);
  if (!item) {
    return tree;
  }

  if (action.type === "instruction") {
    const instruction = action.instruction;

    if (instruction.type === "reparent") {
      const path = treeHelper.getPathToItem({
        current: tree,
        targetId: action.targetId,
      });
      invariant(path);
      const desiredId = path[instruction.desiredLevel];
      let result = treeHelper.remove(tree, action.itemId);
      result = treeHelper.insertAfter(result, desiredId, item);
      return result;
    }

    // the rest of the actions require you to drop on something else
    if (action.itemId === action.targetId) {
      return tree;
    }

    if (instruction.type === "reorder-above") {
      let result = treeHelper.remove(tree, action.itemId);
      result = treeHelper.insertBefore(result, action.targetId, item);
      return result;
    }

    if (instruction.type === "reorder-below") {
      let result = treeHelper.remove(tree, action.itemId);
      result = treeHelper.insertAfter(result, action.targetId, item);
      return result;
    }

    if (instruction.type === "make-child") {
      let result = treeHelper.remove(tree, action.itemId);
      result = treeHelper.insertChild(result, action.targetId, item);
      return result;
    }

    console.warn("TODO: action not implemented", instruction);

    return tree;
  }

  function toggle(
    item: TreeItem,
    targetId: string,
    force: boolean = false
  ): TreeItem {
    if (!force && !treeHelper.hasChildren(item)) {
      return item;
    }

    if (item.id === targetId) {
      return { ...item, open: !item?.open, force };
    }

    return {
      ...item,
      children: item.children.map((child) => toggle(child, targetId, force)),
    };
  }

  if (action.type === "toggle") {
    return tree.map((item) => toggle(item, action.itemId, action?.force));
  }

  if (action.type === "expand") {
    if ((treeHelper.hasChildren(item) || action?.force) && !item?.open) {
      return tree.map((item) => toggle(item, action.itemId, action?.force));
    }
    return tree;
  }

  if (action.type === "collapse") {
    if ((treeHelper.hasChildren(item) || action?.force) && item?.open) {
      return tree.map((item) => toggle(item, action.itemId, action?.force));
    }
    return tree;
  }

  if (action.type === "modal-move") {
    let result = treeHelper.remove(tree, item.id);

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
        result = treeHelper.insertChild(result, action.targetId, item);
      }
    } else if (action.index === siblingItems.length) {
      const relativeTo = siblingItems[siblingItems.length - 1];
      /**
       * If the position selected is the end, we insert after the last item.
       */
      result = treeHelper.insertAfter(result, relativeTo.id, item);
    } else {
      const relativeTo = siblingItems[action.index];
      /**
       * Otherwise we insert before the existing item in the given position.
       * This results in the new item being in that position.
       */
      result = treeHelper.insertBefore(result, relativeTo.id, item);
    }

    return result;
  }

  if (action.type === "attribute-data-update") {
    // Validate that the action is for an attribute item and that the data is present
    const isAttribute = item.type === "attribute";
    invariant(isAttribute, "Cannot update data for non-attribute item.");
    invariant(action.attributeData, "Missing data for attribute-data-update.");
    const incomingData = action.attributeData;

    const updatedData: TreeItemData["attribute"] = produce(
      item.data.attribute,
      (draft) => {
        draft.name = incomingData.name ?? draft.name;
        draft.value = incomingData.value ?? draft.value;
        draft.operator = incomingData.operator ?? draft.operator;
      }
    );
    return treeHelper.updateAttributeData(tree, action.itemId, updatedData);
  }

  return tree;
};

function getChildItems(data: TreeItem[], targetId: string) {
  /**
   * An empty string is representing the root
   */
  if (targetId === "") {
    return data;
  }

  const targetItem = treeHelper.find(data, targetId);
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
