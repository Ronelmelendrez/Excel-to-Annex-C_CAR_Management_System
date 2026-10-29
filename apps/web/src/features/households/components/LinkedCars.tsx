import React from "react";
import type { HouseholdRecord } from "../types";
import { HouseholdSectionHeading } from "./primitives";

export function LinkedCars({ household }: { household: HouseholdRecord }) {
  return (
    <section aria-labelledby="linked-cars-heading">
      <HouseholdSectionHeading id="linked-cars-heading">Linked CARs</HouseholdSectionHeading>
      {household.car ? (
        <details className="mt-2 border border-[#c9c3b6] bg-[#fbf9f4]">
          <summary className="min-h-[44px] cursor-pointer px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]">
            {household.car.reference}
            <span className="ml-2 text-xs text-[#5b574e]">{household.car.status}</span>
          </summary>
          <p className="border-t border-[#e2ddd1] px-3 py-2 text-xs leading-5 text-[#5b574e]">
            Mock CAR reference only. CAR authoring and review are not connected in this UI.
          </p>
        </details>
      ) : (
        <p className="mt-2 text-sm text-[#5b574e]">No CAR is linked in this sample record.</p>
      )}
    </section>
  );
}
