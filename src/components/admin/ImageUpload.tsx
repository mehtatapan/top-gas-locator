import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Drive folder module (e.g. "promotions", "location-photos") */
  module: string;
  /** Extra folder path under the module, slash-separated. */
  subPath?: string;
  disabled?: boolean;
  /** Show URL text input as a fallback (default true). */
  allowUrl?: boolean;
  className?: string;
}

const MAX_BYTES = 25 * 1024 * 1024;

/** Direct-embed URL for a public Google Drive image (works in <img src>). */
function driveImageUrl(fileId: string) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
}

export default function ImageUpload({
  value,
  onChange,
  module,
  subPath,
  disabled,
  allowUrl = true,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Please pick a JPG, PNG, or WebP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max 25MB.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("You must be signed in to upload.");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", module);
      if (subPath) fd.append("subPath", subPath);
      fd.append("public", "true");

      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Upload failed (${res.status})`);

      const fileId = json?.attachment?.drive_file_id as string | undefined;
      if (!fileId) throw new Error("Upload succeeded but no file id returned.");

      onChange(driveImageUrl(fileId));
      toast({ title: "Image uploaded to Google Drive" });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
        {value ? (
          <img
            src={value}
            alt="Preview"
            className="h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value && !busy && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {allowUrl && (
        <div className="mt-2">
          <Input
            value={value}
            placeholder="…or paste an image URL"
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || busy}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Images are stored in your Google Drive folder — not in the database.
          </p>
        </div>
      )}
    </div>
  );
}
