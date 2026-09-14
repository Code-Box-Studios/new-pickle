// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/ui/stat-card";
import { CalendarDays } from "lucide-react";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard icon={<CalendarDays />} label="Today" value="5" />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("applies urgent amber styles when urgent is true", () => {
    const { container } = render(
      <StatCard icon={<CalendarDays />} label="Pending" value="3" urgent />
    );
    expect(container.firstChild).toHaveClass("border-amber-200");
  });

  it("does not apply urgent styles by default", () => {
    const { container } = render(
      <StatCard icon={<CalendarDays />} label="Courts" value="2" />
    );
    expect(container.firstChild).not.toHaveClass("border-amber-200");
  });
});
