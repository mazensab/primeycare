import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        [
          "relative isolate flex flex-col gap-6 overflow-hidden rounded-3xl border py-6",
          "border-white/30 bg-gradient-to-br from-white via-neutral-50/90 to-neutral-200/55",
          "text-card-foreground shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
          "backdrop-blur-xl transition-colors",
          "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:content-['']",
          "before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(245,245,246,0.72)_38%,rgba(229,229,231,0.52)_100%)]",
          "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:content-['']",
          "after:bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,255,255,0.18),rgba(209,213,219,0.28))]",
          "dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/[0.03]",
          "dark:before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.13),rgba(255,255,255,0.055)_42%,rgba(255,255,255,0.02)_100%)]",
          "dark:after:bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025),rgba(255,255,255,0.015))]",
        ].join(" "),
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};