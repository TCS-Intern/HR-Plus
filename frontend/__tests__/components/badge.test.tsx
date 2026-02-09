import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("bg-zinc-100", "text-zinc-700");
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success">Hired</Badge>);
    const badge = screen.getByText("Hired");
    expect(badge).toHaveClass("bg-emerald-50", "text-emerald-700");
  });

  it("applies error variant classes", () => {
    render(<Badge variant="error">Rejected</Badge>);
    const badge = screen.getByText("Rejected");
    expect(badge).toHaveClass("bg-rose-50", "text-rose-700");
  });

  it("renders a dot when dot prop is true", () => {
    const { container } = render(<Badge dot>With Dot</Badge>);
    const dot = container.querySelector(".rounded-full.w-1\\.5");
    expect(dot).toBeInTheDocument();
  });

  it("does not render a dot by default", () => {
    const { container } = render(<Badge>No Dot</Badge>);
    const dot = container.querySelector(".w-1\\.5.h-1\\.5");
    expect(dot).not.toBeInTheDocument();
  });

  it("merges custom className", () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("ml-2");
  });
});
