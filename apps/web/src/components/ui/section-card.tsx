import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader } from "./card";

type SectionCardProps = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  headingAs?: "h2" | "h3";
  /** Entrance delay (ms) for the landing-style `fade-up` animation. */
  delay?: number;
  className?: string;
  cardClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  children: React.ReactNode;
};

export function SectionCard({
  id,
  title,
  description,
  eyebrow,
  action,
  headingAs: Heading = "h2",
  delay,
  className,
  cardClassName,
  headerClassName,
  contentClassName,
  titleClassName,
  children,
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(delay !== undefined && "motion-safe:animate-fade-up", className)}
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <Card
        className={cn(
          "rounded-none border-[#c9c3b6] bg-[#fbf9f4] text-[#161512] shadow-none",
          cardClassName,
        )}
      >
        <CardHeader
          className={cn(
            "flex-row items-start justify-between gap-3 space-y-0 border-b border-[#c9c3b6] px-4 py-4 sm:px-5",
            headerClassName,
          )}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5b574e]">
                {eyebrow}
              </p>
            )}
            <Heading id={id} className={cn("font-serif text-xl leading-tight", titleClassName)}>
              {title}
            </Heading>
            {description && (
              <CardDescription className="mt-1 text-sm leading-6 text-[#5b574e]">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
        <CardContent className={cn("p-4 sm:p-5", contentClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
