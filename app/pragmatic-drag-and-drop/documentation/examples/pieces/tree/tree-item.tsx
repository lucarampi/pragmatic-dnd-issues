"use client";
import {
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import invariant from "tiny-invariant";

import ChevronDownIcon from "@atlaskit/icon/glyph/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/glyph/chevron-right";
import { ModalTransition } from "@atlaskit/modal-dialog";
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
  GitPullRequestCreate,
  GitPullRequestCreateArrow,
  GripVertical,
  ListPlus,
  Plus,
  Trash2,
} from "lucide-react";

import {
  AttributeTreeItem,
  DraggingSourceData,
  getDraggingSourceData,
  type TreeItem as TreeItemType,
} from "../../data/tree";

import { indentPerLevel } from "./constants";
import { MoveDialog } from "./move-dialog";
import { DependencyContext, TreeContext } from "./tree-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const iconColor = token("color.icon", "#44546F");

const OPERATORS = ["=", ">", "<", ">=", "<=", "!="];

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

function GroupIcon({ open }: { open: boolean }) {
  const Icon = open ? ChevronDownIcon : ChevronRightIcon;
  return <Icon label="" primaryColor={iconColor} />;
}

function Icon({ item }: { item: TreeItemType }) {
  if (item.type !== "group") {
    return null;
  }
  return <GroupIcon open={!!item?.open} />;
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
    <Fragment>
      <div key={thisTreeItem.id} className="relative">
        <div
          id={`tree-item-${thisTreeItem.id}`}
          key={`tree-item-${thisTreeItem.id}`}
          onClick={toggleOpen}
          ref={treeItemRef}
          style={{ marginLeft: level * indentPerLevel }}
          data-state={state}
          data-index={index}
          data-level={level}
          data-testid={`tree-item-${thisTreeItem.id}`}
          className=" border border-transparent items-center min-w-[600px]  hover:border-blue-500 w-[600px] max-w-[600px] flex gap-2 cursor-pointer rounded px-2 py-1 data-[state=dragging]:opacity-50 data-[state=parent-of-instruction]:bg-blue-50 data-[state=parent-of-instruction]:border-blue-300 "
        >
          <div
            className={cn(
              "flex gap-2 items-center w-full ",
              isGroup ? " sticky top-0" : ""
            )}
          >
            <div ref={dragHandleRef} className="h-full">
              <GripVertical className="cursor-move w-4 h-4 text-slate-500" />
            </div>
            <Icon item={thisTreeItem} />
            <div className="flex gap-2 items-center w-full ">
              {isGroup && (
                <>
                  <div className=" rounded flex justify-center items-center text-slate-500 font-medium bg-blue-100 p-0.5 px-1 min-w-5 text-xs">
                    {thisTreeItem.children.length}
                  </div>
                  <ToggleGroup
                    onClick={(ev) => {
                      ev.stopPropagation();
                    }}
                    type="single"
                  >
                    <ToggleGroupItem value="bold" aria-label="Toggle bold">
                      AND
                    </ToggleGroupItem>
                    <ToggleGroupItem value="italic" aria-label="Toggle italic">
                      OR
                    </ToggleGroupItem>
                  </ToggleGroup>

                  {isGroup && (
                    <div
                      className={cn(
                        "ml-auto",
                        isOpen || !hasChildren ? "flex" : "hidden"
                      )}
                    >
                      <div
                        onClick={(ev) => {
                          ev.stopPropagation();
                        }}
                        className="pl-6 flex items-center gap-2"
                      >
                        <Button
                          variant={"secondary"}
                          className=" px-2.5"
                          onClick={() =>
                            dispatch({
                              type: "add-group",
                              targetId: thisTreeItem.id,
                            })
                          }
                        >
                          <GitPullRequestCreate className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={"secondary"}
                          className=" px-2.5"
                          onClick={() =>
                            dispatch({
                              type: "add-attribute",
                              targetId: thisTreeItem.id,
                            })
                          }
                        >
                          <ListPlus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {isAttribute && (
                <>
                  <Input
                    onChange={(ev) => {
                      const value = {
                        name: ev.target.value,
                      };
                      dispatch({
                        type: "attribute-data-update",
                        itemId: thisTreeItem.id,
                        attributeData: value,
                      });
                    }}
                    value={thisTreeItem.data.attribute.name}
                  />
                  <Select
                    onValueChange={(operator) => {
                      const value = {
                        operator,
                      };
                      dispatch({
                        type: "attribute-data-update",
                        itemId: thisTreeItem.id,
                        attributeData: value,
                      });
                    }}
                    value={thisTreeItem.data.attribute.operator}
                  >
                    <SelectTrigger className="min-w-16 w-16 text-center ">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-16 w-16">
                      {OPERATORS.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {operator}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-36"
                    value={thisTreeItem.data.attribute.value}
                    onChange={(ev) => {
                      const value = {
                        value: ev.target.value,
                      };
                      dispatch({
                        type: "attribute-data-update",
                        itemId: thisTreeItem.id,
                        attributeData: value,
                      });
                    }}
                  />
                  <Button
                    size={"icon"}
                    className="px-2 hover:text-red-600 hover:bg-red-50"
                    variant={"ghost"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          {instruction ? <DropIndicator instruction={instruction} /> : null}
        </div>
      </div>
      {thisTreeItem.children.length && !!thisTreeItem?.open ? (
        <div>
          {thisTreeItem.children.map((child, index, array) => {
            const childType: ItemMode = (() => {
              if (child.children.length && !!child?.open) {
                return "expanded";
              }

              if (index === array.length - 1) {
                return "last-in-group";
              }

              return "standard";
            })();
            return (
              <TreeItemRenerer
                item={child}
                key={child.id}
                level={level + 1}
                mode={childType}
                index={index}
              />
            );
          })}
        </div>
      ) : null}
      {/* {mode ===
        "last-in-group" && (
          <div>
            {isGroup && (
              <div
                className="flex items-center gap-2 cursor-pointer text-blue-500"
                onClick={() =>
                  dispatch({ type: "add-group", parentId: thisTreeItem.id })
                }
              >
                <span>Add Group</span>
              </div>
            )}
            {isAttribute && (
              <div
                className="flex items-center gap-2 cursor-pointer text-blue-500"
                onClick={() =>
                  dispatch({ type: "add-attribute", parentId: thisTreeItem.id })
                }
              >
                <span>Add Attribute</span>
              </div>
            )}
          </div>
        )} */}
    </Fragment>
  );
});

export default TreeItemRenerer;

export function getIsRootDesiredLevel(
  instruction: Instruction | null
): boolean {
  return instruction?.type === "reparent" && instruction.desiredLevel == 0;
}
