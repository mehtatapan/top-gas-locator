import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ACCEPTED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXT = [".pdf", ".doc", ".docx"];
const MAX_SIZE = 10 * 1024 * 1024;

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

export const ResumeDropzone = ({ file, onChange, error }: Props) => {
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    const extOk = ACCEPTED_EXT.some((e) => f.name.toLowerCase().endsWith(e));
    if (!ACCEPTED.includes(f.type) && !extOk) return "Only PDF, DOC, or DOCX files are allowed.";
    if (f.size > MAX_SIZE) return "File must be 10MB or smaller.";
    return null;
  };

  const handleFile = useCallback((f: File | null) => {
    setLocalError(null);
    setProgress(0);
    if (!f) {
      onChange(null);
      return;
    }
    const err = validate(f);
    if (err) {
      setLocalError(err);
      return;
    }
    // Simulated read progress for UX
    let p = 0;
    const t = setInterval(() => {
      p += 20;
      setProgress(Math.min(p, 100));
      if (p >= 100) clearInterval(t);
    }, 60);
    onChange(f);
  }, [onChange]);

  const shownError = error ?? localError;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          drag ? "border-primary bg-primary/5" : "border-border bg-card-elevated hover:border-primary/60"
        }`}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        <p className="font-medium">Drag & drop your resume, or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, DOC, or DOCX · Max 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-md border bg-card p-3">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            {progress < 100 && <Progress value={progress} className="mt-1 h-1" />}
          </div>
          <button
            type="button"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              handleFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {shownError && <p className="mt-2 text-sm text-destructive">{shownError}</p>}
    </div>
  );
};
