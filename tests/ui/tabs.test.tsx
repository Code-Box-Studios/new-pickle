// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tabs } from "@/components/ui/tabs";

const tabs = [
  { label: "Home", value: "home", href: "/venues/x?tab=home" },
  { label: "Book", value: "book", href: "/venues/x?tab=book" },
  { label: "Reviews", value: "reviews", href: "/venues/x?tab=reviews" },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(<Tabs tabs={tabs} activeValue="home" />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  it("applies active styling only to the active tab", () => {
    render(<Tabs tabs={tabs} activeValue="book" />);
    const book = screen.getByText("Book").closest("a")!;
    expect(book).toHaveAttribute("aria-current", "page");
    const home = screen.getByText("Home").closest("a")!;
    expect(home).not.toHaveAttribute("aria-current");
  });

  it("renders tabs as links with correct hrefs", () => {
    render(<Tabs tabs={tabs} activeValue="home" />);
    expect(screen.getByText("Book").closest("a")).toHaveAttribute(
      "href",
      "/venues/x?tab=book",
    );
  });
});
