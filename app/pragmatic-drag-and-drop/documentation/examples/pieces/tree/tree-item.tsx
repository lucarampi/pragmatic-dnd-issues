"use client";
import {
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import invariant from "tiny-invariant";

import {
  type Instruction,
  type ItemMode,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import type { DragLocationHistory } from "@atlaskit/pragmatic-drag-and-drop/types";
import { token } from "@atlaskit/tokens";
import {
  Dice1,
  GitPullRequestCreate,
  GripVertical,
  ListPlus,
  Trash2,
} from "lucide-react";

import {
  DraggingSourceData,
  getDraggingSourceData,
  type TreeItem as TreeItemType,
} from "../../data/tree";

import { indentPerLevel } from "./constants";
import { DependencyContext, TreeContext } from "./tree-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GroupRenderer } from "./group-renderer";
import { AttributeRenderer } from "./attribute-renderer";
import { getIsRootDesiredLevel } from "@/lib/get-is-root-desired-level";
import { cn } from "@/lib/utils";
import TreeIndicator from "./tree-indicator";

const iconColor = token("color.icon", "#44546F");

function DragPreview({ item }: { item: TreeItemType }) {
  const showChildrenCount = item.type === "group" && item.children.length > 0;
  return (
    <div
      data-show-count={showChildrenCount}
      className="bg-blue-700 group/preview p-0.5 h-fit m-5 mt-1 rounded relative flex items-center w-fit  shadow-lg"
    >
      <div className="bg-blue-50 p-1 pl-2 rounded-[2px] group-data-[show-count=true]/preview:rounded-r-none ">
        Item {item.id}
      </div>
      <div className="items-center text-center hidden group-data-[show-count=true]/preview:flex justify-center font-bold text-xs px-2 text-white">
        {item?.children?.length ?? 0}
      </div>
    </div>
  );
}

function getParentLevelOfInstruction(instruction: Instruction): number {
  if (instruction.type === "instruction-blocked") {
    return getParentLevelOfInstruction(instruction.desired);
  }
  if (instruction.type === "reparent") {
    return instruction.desiredLevel - 1;
  }
  return instruction.currentLevel - 1;
}

function delay({
  waitMs: timeMs,
  fn,
}: {
  waitMs: number;
  fn: () => void;
}): () => void {
  let timeoutId: number | null = window.setTimeout(() => {
    timeoutId = null;
    fn();
  }, timeMs);
  return function cancel() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
type ItemState = "idle" | "dragging" | "preview" | "parent-of-instruction";
const TreeItemRenerer = memo(function TreeItemRenerer({
  item: thisTreeItem,
  mode,
  level,
  index,
}: {
  item: TreeItemType;
  mode: ItemMode;
  level: number;
  index: number;
}) {
  const treeItemRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const isRoot = thisTreeItem?.treeRole === "root" && level === 0;
  const isGroup = thisTreeItem.type === "group";
  const isAttribute = thisTreeItem.type === "attribute";
  const isOpen = thisTreeItem?.open ?? false;
  const hasChildren = thisTreeItem.children.length > 0;

  const isLastChild = useMemo(() => mode === "last-in-group", [mode]);

  const [state, setState] = useState<ItemState>("idle");
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const cancelExpandRef = useRef<(() => void) | null>(null);

  const { dispatch, uniqueContextId, getPathToItem, registerTreeItem } =
    useContext(TreeContext);
  const { DropIndicator, attachInstruction, extractInstruction } =
    useContext(DependencyContext);
  const toggleOpen = useCallback(() => {
    dispatch({ type: "toggle", itemId: thisTreeItem.id, force: true });
  }, [dispatch, thisTreeItem]);

  useEffect(() => {
    invariant(treeItemRef.current);
    return registerTreeItem({
      itemId: thisTreeItem.id,
      element: treeItemRef.current,
      // actionMenuTrigger: actionMenuTriggerRef.current,
    });
  }, [thisTreeItem.id, registerTreeItem]);

  const cancelExpand = useCallback(() => {
    cancelExpandRef.current?.();
    cancelExpandRef.current = null;
  }, []);

  const clearParentOfInstructionState = useCallback(() => {
    setState((current) =>
      current === "parent-of-instruction" ? "idle" : current
    );
  }, []);

  // When an item has an instruction applied
  // we are highlighting it's parent item for improved clarity
  const shouldHighlightParent = useCallback(
    (location: DragLocationHistory): boolean => {
      const target = location.current.dropTargets[0];

      if (!target) {
        return false;
      }

      const instruction = extractInstruction(target.data);

      if (!instruction) {
        return false;
      }

      const targetId = target.data.id;
      invariant(typeof targetId === "string");

      const path = getPathToItem(targetId);
      const parentLevel: number = getParentLevelOfInstruction(instruction);
      const parentId = path[parentLevel];
      return parentId === thisTreeItem.id;
    },
    [getPathToItem, extractInstruction, thisTreeItem]
  );

  useEffect(() => {
    invariant(treeItemRef.current);
    invariant(dragHandleRef.current);

    function updateIsParentOfInstruction({
      location,
    }: {
      location: DragLocationHistory;
    }) {
      if (shouldHighlightParent(location)) {
        setState("parent-of-instruction");
        return;
      }
      clearParentOfInstructionState();
    }

    return combine(
      draggable({
        element: treeItemRef.current,
        dragHandle: dragHandleRef.current,
        getInitialData: () => {
          const initialData: DraggingSourceData = {
            draggingItem: thisTreeItem,
            draggingUniqueContextId: uniqueContextId,
            wasOpenOnDragStart: isOpen,
            index,
            level,
          };
          return initialData as unknown as Record<string, unknown>;
        },
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            render: ({ container }) => {
              const root = createRoot(container);
              root.render(<DragPreview item={thisTreeItem} />);
              return () => root.unmount();
            },
            nativeSetDragImage,
          });
        },
        onDragStart: ({ source }) => {
          setState("dragging");
          const { wasOpenOnDragStart } = getDraggingSourceData(source);
          // collapse open items during a drag
          if (wasOpenOnDragStart) {
            dispatch({ type: "collapse", itemId: thisTreeItem.id });
          }
        },
        onDrop: ({ source }) => {
          setState("idle");
          const { wasOpenOnDragStart } = getDraggingSourceData(source);
          if (wasOpenOnDragStart) {
            dispatch({ type: "expand", itemId: thisTreeItem.id });
          }
        },
      }),
      dropTargetForElements({
        element: treeItemRef.current,
        getData: ({ input, element }) => {
          return attachInstruction(thisTreeItem, {
            input,
            element,
            indentPerLevel,
            currentLevel: level,
            mode,
            block: isAttribute
              ? ["make-child"]
              : isRoot
              ? ["reparent", "reorder-above", "reorder-below"]
              : [],
          });
        },
        canDrop: ({ source, element, input }) => {
          const { draggingItem, draggingUniqueContextId } =
            getDraggingSourceData(source);

          const isSameContext = draggingUniqueContextId === uniqueContextId;
          const isSameItem = draggingItem.id === thisTreeItem.id;

          // ================================ DO NOT TOUCH ================================
          // THIS SOLVES A BUG WHERE THE LIBRARY DOES NOT IDENTIFY THE CORRECT DROP TARGET
          const dropTargetBugBypass = attachInstruction(thisTreeItem, {
            input,
            element,
            indentPerLevel,
            currentLevel: level,
            mode,
          });
          const fixedInstruction = extractInstruction(dropTargetBugBypass);
          // This is the correct desired level for the drop target
          function getBypassParams() {
            const desiredLevel =
              fixedInstruction?.type == "reparent"
                ? fixedInstruction?.desiredLevel
                : null;
            const isRootDesiredLevel = getIsRootDesiredLevel(fixedInstruction);
            return {
              desiredLevel,
              isRootDesiredLevel,
            };
          }
          // =============================== END OF BYPASS ===============================

          const { isRootDesiredLevel } = getBypassParams();

          if (isRootDesiredLevel || isSameItem || !isSameContext) {
            return false;
          }
          return true;
        },
        onDrag: ({ self, source }) => {
          const instruction = extractInstruction(self.data);
          const { draggingItem, draggingUniqueContextId } =
            getDraggingSourceData(source);

          if (draggingItem.id !== thisTreeItem.id) {
            // expand after 500ms if still merging
            if (
              instruction?.type === "make-child" &&
              thisTreeItem.children.length &&
              !thisTreeItem.isOpen &&
              !cancelExpandRef.current
            ) {
              cancelExpandRef.current = delay({
                waitMs: 500,
                fn: () => dispatch({ type: "expand", itemId: thisTreeItem.id }),
              });
            }
            if (instruction?.type !== "make-child" && cancelExpandRef.current) {
              cancelExpand();
            }

            setInstruction(instruction);
            return;
          }
          if (instruction?.type === "reparent") {
            setInstruction(instruction);
            return;
          }
          setInstruction(null);
        },
        onDragLeave: () => {
          cancelExpand();
          setInstruction(null);
        },
        onDrop: () => {
          cancelExpand();
          setInstruction(null);
        },
      }),
      monitorForElements({
        canMonitor: ({ source }) => {
          const { draggingItem, draggingUniqueContextId } =
            getDraggingSourceData(source);
          return draggingUniqueContextId === uniqueContextId;
        },
        onDragStart: updateIsParentOfInstruction,
        onDrag: updateIsParentOfInstruction,
        onDrop() {
          clearParentOfInstructionState();
        },
      })
    );
  }, [
    dispatch,
    thisTreeItem,
    mode,
    level,
    cancelExpand,
    uniqueContextId,
    extractInstruction,
    attachInstruction,
    getPathToItem,
    clearParentOfInstructionState,
    shouldHighlightParent,
  ]);

  useEffect(
    function mount() {
      return function unmount() {
        cancelExpand();
      };
    },
    [cancelExpand]
  );

  return (
    <div className="flex relative flex-col flex-1 ">
      <div key={thisTreeItem.id} className="relative w-fit h-20 ">
        <div
          id={`tree-item-${thisTreeItem.id}`}
          key={`tree-item-${thisTreeItem.id}`}
          onClick={toggleOpen}
          // style={{ marginLeft: level * indentPerLevel }}
          data-state={state}
          data-index={index}
          data-level={level}
          data-testid={`tree-item-${thisTreeItem.id}`}
          className=" relative w-fit h-full flex items-center group/item "
        >
          <div className="h-full w-fit flex items-center justify-start">
            {Array.from({ length: level - 1 })
              .fill(0)
              .map((_, i) => (
                <div
                  className={cn(
                    " h-full w-8 flex justify-center ",
                    isRoot || level == 1 ? "hidden" : "flex"
                  )}
                >
                  <TreeIndicator />
                </div>
              ))}
            <div
              className={cn(
                " h-full  flex-col   w-8 ",
                isRoot ? "hidden" : "flex"
              )}
            >
              <div className="h-1/2 items-center w-full flex flex-col ">
                <TreeIndicator />
                <div className="w-1/2 self-end mr-px">
                  <TreeIndicator direction="horizontal" />
                </div>
              </div>
              <div className="h-1/2 w-full flex justify-center ">
                {<TreeIndicator />}
              </div>
            </div>
          </div>
          {isGroup && (
            <>
              <GroupRenderer
                key={thisTreeItem.id}
                dragHandleRef={dragHandleRef}
                treeItem={thisTreeItem}
                ref={treeItemRef}
              />
            </>
          )}

          {isAttribute && (
            <>
              <AttributeRenderer
                key={thisTreeItem.id}
                dragHandleRef={dragHandleRef}
                treeItem={thisTreeItem}
                ref={treeItemRef}
              />
            </>
          )}
          {instruction ? <DropIndicator instruction={instruction} /> : null}
        </div>
      </div>

      {thisTreeItem.children.length && !!thisTreeItem?.open
        ? thisTreeItem.children.map((child, childIndex, array) => {
            const childType: ItemMode = (() => {
              if (child.children.length && !!child?.open) {
                return "expanded";
              }

              if (childIndex === array.length - 1) {
                return "last-in-group";
              }

              return "standard";
            })();
            return (
              <>
                <TreeItemRenerer
                  item={child}
                  key={child.id}
                  level={level + 1}
                  mode={childType}
                  index={childIndex}
                />
              </>
            );
          })
        : null}
      {isGroup && isOpen && (
        <div
          className={cn(
            thisTreeItem.open || !hasChildren ? "flex h-14" : "hidden"
          )}
        >
          <div className="h-full w-fit flex items-center justify-start">
            {Array.from({ length: level })
              .fill(0)
              .map((_, i) => (
                <div className=" h-full w-8 flex justify-center">
                  <TreeIndicator />
                </div>
              ))}
            <div className=" h-full flex flex-col  w-8 ">
              <div className="h-1/2 items-center w-full flex flex-col  ">
                <TreeIndicator />
                <div className="w-1/2 mr-px self-end">
                  <TreeIndicator direction="horizontal" />
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={(ev) => {
              ev.stopPropagation();
            }}
            className="pl-0 relative flex items-center gap-2 "
          >
            <Button
              className=" px-2.5 gap-2 text-base "
              onClick={() =>
                dispatch({
                  type: "add-group",
                  targetId: thisTreeItem.id,
                })
              }
            >
              <GitPullRequestCreate className="w-4 h-4" /> New group
            </Button>
            <Button
              className=" px-2.5 gap-2 text-base "
              onClick={() =>
                dispatch({
                  type: "add-attribute",
                  targetId: thisTreeItem.id,
                })
              }
            >
              <ListPlus className="w-4 h-4" /> Add attribute
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TreeItemRenerer;
