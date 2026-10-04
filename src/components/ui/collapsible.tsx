"use client";
import * as React from "react";
import { Collapsible as Primitive } from "radix-ui";

export function Collapsible(
  props: React.ComponentProps<typeof Primitive.Root>,
) {
  return <Primitive.Root data-slot="collapsible" {...props} />;
}
export function CollapsibleTrigger(
  props: React.ComponentProps<typeof Primitive.Trigger>,
) {
  return <Primitive.Trigger data-slot="collapsible-trigger" {...props} />;
}
export function CollapsibleContent(
  props: React.ComponentProps<typeof Primitive.Content>,
) {
  return <Primitive.Content data-slot="collapsible-content" {...props} />;
}
