import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface TreeIndicatorProps {
  direction?: "vertical" | "horizontal";
}

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & TreeIndicatorProps
>(({ className, direction = "vertical", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-slate-800 rounded-md ",
        direction === "vertical" ? "w-0.5 h-full" : "h-0.5 w-full",
        className
      )}
      {...props}
    />
  );
});

TreeIndicator.displayName = "TreeIndicator";

export default TreeIndicator;
