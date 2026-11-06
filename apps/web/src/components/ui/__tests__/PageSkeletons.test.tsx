import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageDataSkeleton, RouteLoadingSkeleton } from "../PageSkeletons";
import { LoadingScreen } from "../LoadingScreen";

describe("page-specific loading skeletons", () => {
  afterEach(cleanup);

  it.each([
    ["/", "Loading A clearer workspace for CAR operations."],
    ["/dashboard", "Loading Operations at a glance"],
    ["/households", "Loading Households"],
    ["/cars", "Loading Case Assessment Reports"],
    ["/audit", "Loading Audit trail"],
    ["/templates", "Loading Annex C report generator"],
    ["/imports", "Loading Excel imports"],
    ["/review", "Loading CAR review"],
    ["/login", "Loading Sign in to your account"],
    ["/forgot-password", "Loading Reset your password"],
    ["/reset-password", "Loading Update your password"],
  ])("shows the matching skeleton for %s", (pathname, accessibleName) => {
    render(<RouteLoadingSkeleton pathname={pathname} />);

    expect(screen.getByRole("status", { name: accessibleName })).toBeTruthy();
  });

  it("provides an accessible skeleton for a page's data-loading state", () => {
    render(<PageDataSkeleton page="households" />);

    expect(screen.getByRole("status", { name: "Loading Households" })).toBeTruthy();
  });

  it("shows a progress bar instead of a spinner during startup", () => {
    render(<LoadingScreen />);

    expect(screen.getByRole("progressbar", { name: "Preparing your workspace" })).toBeTruthy();
    expect(screen.queryByText("Preparing your workspace")).toBeTruthy();
    expect(document.querySelector(".animate-spin")).toBeNull();
  });
});
