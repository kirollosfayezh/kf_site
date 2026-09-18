import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

type RevealProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Reveal<T extends ElementType = "div">({ as, children, className = "", ...rest }: RevealProps<T>) {
  const Tag = (as || "div") as ElementType;
  const ref = useReveal<HTMLElement>();
  return (
    <Tag ref={ref} className={`kf-reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
