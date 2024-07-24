import { Instruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/dist/types/tree-item";

export function getIsRootDesiredLevel(
    instruction: Instruction | null
  ): boolean {
    return instruction?.type === "reparent" && instruction.desiredLevel == 0;
  }
  