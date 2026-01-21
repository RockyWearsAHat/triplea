import type { ReactNode } from "react";
import { spacing } from "@shared";

type SectionProps = {
  title: string;
  children: ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <h2
        data-reveal
        style={{
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
