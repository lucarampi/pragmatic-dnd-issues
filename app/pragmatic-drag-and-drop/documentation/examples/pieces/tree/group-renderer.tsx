"use client";
import { forwardRef, useContext } from "react";
import { GroupTreeItem, TreeItem } from "../../data/tree";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DependencyContext, TreeContext } from "./tree-context";
import {
  ChevronRight,
  GitPullRequestCreate,
  GripVertical,
  ListPlus,
} from "lucide-react";
import invariant from "tiny-invariant";

interface GroupRendererProps {
  treeItem: GroupTreeItem;
  dragHandleRef: React.RefObject<HTMLDivElement>;
}

function ChildConter({ treeItem }: { treeItem: TreeItem }) {
  const { children = [] } = treeItem;
  const count = children.length;
  return (
    <div className=" rounded flex justify-center items-center text-slate-500 font-medium bg-blue-100 p-0.5 px-1 min-w-5 text-xs">
      {count}
    </div>
  );
}

function ChevronIcon({ item }: { item: TreeItem }) {
  if (item.type !== "group") {
    return null;
  }
  return (
    <ChevronRight
      className={cn(
        "w-4 h-4 text-slate-600 transition-all",
        !!item?.open && "rotate-90"
      )}
    />
  );
}

export const GroupRenderer = forwardRef<HTMLDivElement, GroupRendererProps>(
  ({ treeItem, dragHandleRef }, ref) => {
    const { operator } = treeItem.data;
    const hasChildren = treeItem.children.length > 0;

    const { dispatch, uniqueContextId, getPathToItem, registerTreeItem } =
      useContext(TreeContext);
    const { DropIndicator, attachInstruction, extractInstruction } =
      useContext(DependencyContext);

    return (
      <div className="flex relative py-2 items-center w-full ">
        <div
          ref={ref}
          className="flex h-14 gap-2 relative border  border-transparent items-center w-full group-data-[state=parent-of-instruction]/item:bg-blue-50 group-data-[state=parent-of-instruction]/item:border-blue-300"
        >
          <div
            ref={dragHandleRef}
            className="cursor-move absolute -left-2.5 hover:bg-slate-100 transition-colors bg-slate-50 rounded border border-slate-300 top-1/2 -translate-y-1/2 flex items-center px-0.5 py-1"
          >
            <GripVertical className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-100 h-full border rounded border-slate-200 shadow">
            <div className="ml-3 mr-2">
              <ChevronIcon item={treeItem} />
            </div>
            <ToggleGroup
              className="p-1 bg-white gap-1 rounded-sm border border-slate-200"
              onClick={(ev) => {
                ev.stopPropagation();
              }}
              defaultValue={operator}
              type="single"
            >
              <ToggleGroupItem
                className="h-9 w-12 min-w-14 data-[state=off]:hover:text-slate-800 data-[state=on]:bg-blue-50 border border-transparent data-[state=on]:border-blue-300 "
                value="AND"
                aria-label="Toggle AND"
              >
                AND
              </ToggleGroupItem>
              <ToggleGroupItem
                className="h-9 w-12 min-w-14 data-[state=off]:hover:text-slate-800 data-[state=on]:bg-blue-50 border border-transparent data-[state=on]:border-blue-300 "
                value="OR"
                aria-label="Toggle OR"
              >
                OR
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <ChildConter treeItem={treeItem} />

          <div
            className={cn(
              "ml-auto",
              treeItem.open || !hasChildren ? "flex" : "hidden"
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
                    targetId: treeItem.id,
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
                    targetId: treeItem.id,
                  })
                }
              >
                <ListPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
