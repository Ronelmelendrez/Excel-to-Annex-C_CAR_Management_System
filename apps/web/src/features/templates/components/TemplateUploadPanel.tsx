import React, { useRef } from "react";
import { Label } from "../../../components/ui/label";
import { SectionCard } from "../../../components/ui/section-card";

export function TemplateUploadPanel({
  fileError,
  selectedFile,
  onChooseFile,
  onAddDraft,
}: {
  fileError: string;
  selectedFile: File | null;
  onChooseFile: (file: File | null) => void;
  onAddDraft: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <SectionCard
      id="template-upload-heading"
      eyebrow="New version"
      title="Add a template draft"
      description="DOCX only · 5 MB maximum"
    >
      <Label htmlFor="template-file" className="block text-xs font-semibold">
        Word template
      </Label>
      <input
        ref={fileInput}
        id="template-file"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => onChooseFile(event.target.files?.[0] ?? null)}
        aria-describedby={fileError ? "template-file-error" : "template-upload-help"}
        className="mt-1 block min-h-[44px] w-full text-sm file:mr-3 file:min-h-[40px] file:border file:border-[#8c877c] file:bg-[#ece7dc] file:px-3 file:text-xs file:font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
      />
      {fileError ? (
        <p id="template-file-error" role="alert" className="mt-2 text-xs leading-5 text-[#7a1f1f]">
          {fileError}
        </p>
      ) : (
        <p id="template-upload-help" className="mt-2 text-xs leading-5 text-[#5b574e]">
          Mock only: the file is not uploaded or stored. Placeholder detection uses sample data.
        </p>
      )}
      {selectedFile && (
        <p className="mt-2 break-all text-xs text-[#3f3b34]">
          Selected: {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          onAddDraft();
          if (fileInput.current) fileInput.current.value = "";
        }}
        disabled={!selectedFile}
        className="mt-3 min-h-[44px] w-full border border-[#161512] bg-[#161512] px-3 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
      >
        Add mock draft version
      </button>
    </SectionCard>
  );
}
