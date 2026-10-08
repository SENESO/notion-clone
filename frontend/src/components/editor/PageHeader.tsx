import { useEffect, useState } from "react";
import type { Page } from "@/stores/pagesStore";

interface PageHeaderProps {
  page: Page | null;
  onUpdateTitle: (title: string) => Promise<unknown>;
}

export default function PageHeader({ page, onUpdateTitle }: PageHeaderProps) {
  const [title, setTitle] = useState(page?.title ?? "Untitled");
  const [isSaving, setIsSaving] = useState(false);

  // Keep the input in sync when navigating between pages
  useEffect(() => {
    setTitle(page?.title ?? "Untitled");
  }, [page?.id, page?.title]);

  const commitTitle = async () => {
    if (!page || title === page.title) return;
    setIsSaving(true);
    try {
      await onUpdateTitle(title.trim() === "" ? "Untitled" : title);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {page?.cover && (
        <div className="h-40 w-full overflow-hidden rounded-lg">
          <img
            src={page.cover}
            alt="Page cover"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        {page?.icon && <span className="text-4xl">{page.icon}</span>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Untitled"
          disabled={isSaving || !page}
          className="w-full bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}
