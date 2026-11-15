"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityCard } from "./EntityCard";
import { RenameForm } from "./RenameForm";
import { DeleteButton, type DeleteLabels } from "./DeleteButton";

export type GridItem = { id: string; href: string; title: string; subtitle?: string; imageUrl?: string };

export function EditableGrid({
  heading,
  items,
  canManage,
  isAdmin,
  empty,
  reorder,
  rename,
  remove,
  labels,
}: {
  heading: React.ReactNode;
  items: GridItem[];
  canManage: boolean;
  isAdmin: boolean;
  empty: string;
  reorder: (ids: string[]) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  labels: {
    edit: string;
    done: string;
    rename: string;
    save: string;
    cancel: string;
    failed: string;
    del: DeleteLabels;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const ids = items.map((i) => i.id);
  const shown = order ? [...order.filter((i) => ids.includes(i)), ...ids.filter((i) => !order.includes(i))] : ids;
  const byId = new Map(items.map((i) => [i.id, i]));

  function over(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = shown.filter((i) => i !== dragId);
    next.splice(next.indexOf(targetId) + (shown.indexOf(dragId) < shown.indexOf(targetId) ? 1 : 0), 0, dragId);
    setOrder(next);
  }

  async function drop() {
    setDragId(null);
    if (!order || order.join() === ids.join()) return;
    try {
      setSaveFailed(false);
      await reorder(shown);
      router.refresh();
    } catch {
      setSaveFailed(true);
      setOrder(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>{heading}</div>
        {canManage && items.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={editing ? "btn" : "btn-ghost"}
          >
            {editing ? `✓ ${labels.done}` : `✎ ${labels.edit}`}
          </button>
        )}
      </div>
      {saveFailed && <p className="text-sm text-red-600">{labels.failed}</p>}
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((id) => {
            const it = byId.get(id)!;
            return (
              <div
                key={id}
                draggable={editing}
                onDragStart={() => setDragId(id)}
                onDragOver={(e) => {
                  if (!editing) return;
                  e.preventDefault();
                  over(id);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={drop}
                className={`h-full rounded-3xl transition ${dragId === id ? "opacity-40" : ""} ${editing ? "outline-2 outline-dashed outline-offset-4 outline-navy/25" : ""}`}
              >
                <EntityCard
                  href={it.href}
                  title={it.title}
                  subtitle={it.subtitle}
                  imageUrl={it.imageUrl}
                  editing={editing}
                  actions={
                    <>
                      <RenameForm
                        initial={it.title}
                        action={(name) => rename(it.id, name)}
                        labels={labels}
                      />
                      {isAdmin && (
                        <DeleteButton action={() => remove(it.id)} name={it.title} labels={labels.del} />
                      )}
                    </>
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted">{empty}</p>
      )}
    </div>
  );
}
