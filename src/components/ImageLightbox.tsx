import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/** Full-screen image viewer. Renders when `src` is a non-empty string. */
export function ImageLightbox({ src, alt, onClose }: Props) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
        {src && (
          <img
            src={src}
            alt={alt ?? ""}
            className="mx-auto max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
