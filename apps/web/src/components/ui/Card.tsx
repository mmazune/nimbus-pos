import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className, padded = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface text-text-primary shadow-subtle",
        padded && "p-5",
        className,
      )}
      {...props}
    />
  );
}
