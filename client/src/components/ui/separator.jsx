import * as React from "react";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <div
    ref={ref}
    role={decorative ? undefined : "separator"}
    aria-orientation={decorative ? undefined : orientation}
    aria-hidden={decorative ? true : undefined}
    data-orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
