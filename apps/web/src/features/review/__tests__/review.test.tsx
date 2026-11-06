import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewPage } from "../components/ReviewPage";

describe("CAR review availability", () => {
  it("clearly disables sample submissions and simulated decisions", () => {
    render(<ReviewPage />);

    expect(screen.getByRole("heading", { name: "CAR review is paused" })).toBeTruthy();
    expect(screen.getByText(/You cannot record or change a decision here at this time/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
  });
});
