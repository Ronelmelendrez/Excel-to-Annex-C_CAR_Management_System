import React from "react";

export function RecommendationSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section aria-labelledby="recommendation-heading" className="px-4 py-5 sm:px-5">
      <h3 id="recommendation-heading" className="mb-4 font-serif text-xl">Recommendation</h3>
      <label htmlFor="recommendation" className="block text-sm font-semibold">Case worker recommendation</label>
      <p className="mt-1 text-xs leading-5 text-[#5b574e]">
        Enter the responsible case worker’s recommendation. No suggested text is generated.
      </p>
      <textarea
        id="recommendation"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-y border border-[#8c877c] bg-[#fbf9f4] px-3 py-2 text-sm leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        placeholder="Leave blank until a recommendation has been prepared."
      />
    </section>
  );
}
