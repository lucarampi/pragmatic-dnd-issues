"use client";
import { forwardRef, useContext } from "react";
import { AttributeTreeItem } from "../../data/tree";
import { Button } from "@/components/ui/button";
import { DependencyContext, TreeContext } from "./tree-context";
import { CopyPlus, GripVertical, Info, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TreeIndicator from "./tree-indicator";

interface AttributeRendererProps {
  treeItem: AttributeTreeItem;
  dragHandleRef: React.RefObject<HTMLDivElement>;
}
const OPERATORS = ["=", ">", "<", ">=", "<=", "!="];

export const AttributeRenderer = forwardRef<
  HTMLDivElement,
  AttributeRendererProps
>(({ treeItem, dragHandleRef }, ref) => {
  const { attribute } = treeItem.data;

  const { dispatch, uniqueContextId, getPathToItem, registerTreeItem } =
    useContext(TreeContext);
  const { DropIndicator, attachInstruction, extractInstruction } =
    useContext(DependencyContext);
  console.log("🚀 ~ dragHandleRef:", dragHandleRef);

  return (
    <div
      ref={ref}
      className="flex h-14 bg-green-200 relative gap-2 items-center w-[600px] min-w-[600px]"
    >
      <div
        ref={dragHandleRef}
        className="cursor-move absolute -left-2.5 hover:bg-slate-100 transition-colors bg-slate-50 rounded border border-slate-300 top-1/2 -translate-y-1/2 flex items-center px-0.5 py-1"
      >
        <GripVertical className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex  items-center w-full flex-1 gap-2 p-1 bg-slate-50 h-full border rounded border-slate-200 px-4">
        <span className="text-slate-800 font-medium flex items-center gap-2">
          {treeItem.data.attribute.name}
          <div>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
        </span>
        <div className="flex flex-1 justify-end items-center gap-2 relative">
          <Select
            onValueChange={(operator) => {
              const value = {
                operator,
              };
              dispatch({
                type: "attribute-data-update",
                itemId: treeItem.id,
                attributeData: value,
              });
            }}
            value={treeItem.data.attribute.operator}
          >
            <SelectTrigger className="min-w-16 w-16 text-center bg-white shadow-none ">
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
            className="w-36 bg-white shadow-none"
            value={treeItem.data.attribute.value}
            onChange={(ev) => {
              const value = {
                value: ev.target.value,
              };
              dispatch({
                type: "attribute-data-update",
                itemId: treeItem.id,
                attributeData: value,
              });
            }}
          />
          <Button
            size={"icon"}
            className="px-2 text-blue-600 hover:text-blue-600 hover:bg-blue-50"
            variant={"ghost"}
          >
            <CopyPlus className="w-4 h-4" />
          </Button>
          <Button
            size={"icon"}
            className="px-2 hover:text-red-600 text-red-600 hover:bg-red-50"
            variant={"ghost"}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});
