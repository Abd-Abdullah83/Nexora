"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

// ── Types ──────────────────────────────────────────────────────────────────

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  level: number;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
}

function getCsrf(): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Flatten tree for dropdowns ─────────────────────────────────────────────
function flattenTree(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: "—".repeat(depth) + " " + n.name },
    ...flattenTree(n.children, depth + 1),
  ]);
}

// ── Single tree node row ───────────────────────────────────────────────────
function CategoryRow({
  node,
  allCategories,
  onRefresh,
}: {
  node: CategoryNode;
  allCategories: { id: string; label: string }[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [editSlug, setEditSlug] = useState(node.slug);
  const [editDesc, setEditDesc] = useState(node.description ?? "");
  const [editActive, setEditActive] = useState(node.isActive);
  const [saving, setSaving] = useState(false);

  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childDesc, setChildDesc] = useState("");
  const [creatingChild, setCreatingChild] = useState(false);

  const [moving, setMoving] = useState(false);
  const [newParentId, setNewParentId] = useState("");

  const indent = node.level * 20;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/categories/${node.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          name: editName,
          slug: editSlug,
          description: editDesc || null,
          isActive: editActive,
        }),
      });
      if (res.ok) { setEditing(false); onRefresh(); }
      else { const d = await res.json(); alert(d.error ?? "Failed to save."); }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (node.productCount > 0) {
      alert(`Cannot delete "${node.name}" — it has ${node.productCount} product(s). Reassign them first.`);
      return;
    }
    if (node.children.length > 0) {
      alert(`Cannot delete "${node.name}" — it has ${node.children.length} subcategorie(s). Delete them first.`);
      return;
    }
    if (!confirm(`Delete "${node.name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${node.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    if (res.ok) onRefresh();
    else { const d = await res.json(); alert(d.error ?? "Failed to delete."); }
  }

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    setCreatingChild(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          name: childName,
          slug: slugify(childName),
          description: childDesc || undefined,
          parentId: node.id,
        }),
      });
      if (res.ok) {
        setAddingChild(false);
        setChildName("");
        setChildDesc("");
        onRefresh();
      } else { const d = await res.json(); alert(d.error ?? "Failed to create."); }
    } finally { setCreatingChild(false); }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/categories/${node.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ newParentId: newParentId || null }),
    });
    if (res.ok) { setMoving(false); setNewParentId(""); onRefresh(); }
    else { const d = await res.json(); alert(d.error ?? "Failed to move."); }
  }

  const hasChildren = node.children.length > 0;

  return (
    <div>
      {/* Row */}
      <div
        className="flex items-center gap-2 rounded-sm py-2 pr-3 transition hover:bg-white/[0.03]"
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center text-xs text-slate/50 transition ${hasChildren ? "hover:text-brass" : "opacity-0 pointer-events-none"}`}
        >
          {expanded ? "▾" : "▸"}
        </button>

        {/* Status dot */}
        <div className={`h-2 w-2 flex-shrink-0 rounded-full ${node.isActive ? "bg-emerald-400" : "bg-slate/40"}`} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-cream">{node.name}</span>
          <span className="ml-2 text-xs text-slate/40 font-mono">{node.slug}</span>
          {node.productCount > 0 && (
            <span className="ml-2 text-xs text-brass/60">{node.productCount} products</span>
          )}
          {node.children.length > 0 && (
            <span className="ml-2 text-xs text-slate/40">{node.children.length} subcategories</span>
          )}
        </div>

        {/* Level badge */}
        <span className="flex-shrink-0 text-[10px] text-slate/30">L{node.level}</span>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2 text-xs">
          <button onClick={() => setAddingChild((v) => !v)} className="text-brass hover:underline">+ Sub</button>
          <button onClick={() => setEditing((v) => !v)} className="text-slate hover:text-cream">Edit</button>
          <button onClick={() => setMoving((v) => !v)} className="text-slate hover:text-cream">Move</button>
          <button onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div
          className="mb-2 rounded-sm border border-brass/20 bg-surface p-4"
          style={{ marginLeft: `${indent + 32}px` }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate">Name</label>
              <input value={editName} onChange={(e) => { setEditName(e.target.value); setEditSlug(slugify(e.target.value)); }}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-sm text-cream outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate">Slug</label>
              <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-sm text-cream font-mono outline-none focus:border-brass/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate">Description</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-sm text-cream outline-none focus:border-brass/50" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate cursor-pointer">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Active
            </label>
            <button onClick={handleSave} disabled={saving}
              className="rounded-sm bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brassLight disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate hover:text-cream">Cancel</button>
          </div>
        </div>
      )}

      {/* Move form */}
      {moving && (
        <form
          onSubmit={handleMove}
          className="mb-2 flex items-center gap-3 rounded-sm border border-white/10 bg-surface p-3"
          style={{ marginLeft: `${indent + 32}px` }}
        >
          <p className="text-xs text-slate flex-shrink-0">Move to:</p>
          <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}
            className="flex-1 rounded-sm border border-white/10 bg-ink/40 px-2 py-1.5 text-sm text-cream outline-none focus:border-brass/50">
            <option value="">Root (no parent)</option>
            {allCategories
              .filter((c) => c.id !== node.id)
              .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button type="submit" className="rounded-sm bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brassLight">Move</button>
          <button type="button" onClick={() => setMoving(false)} className="text-xs text-slate hover:text-cream">Cancel</button>
        </form>
      )}

      {/* Add child form */}
      {addingChild && (
        <form
          onSubmit={handleAddChild}
          className="mb-2 rounded-sm border border-brass/20 bg-surface p-4"
          style={{ marginLeft: `${indent + 32}px` }}
        >
          <p className="mb-3 text-xs font-semibold text-brass">Add subcategory under "{node.name}"</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate">Name *</label>
              <input required value={childName} onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Gaming Laptops"
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-sm text-cream outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate">Description</label>
              <input value={childDesc} onChange={(e) => setChildDesc(e.target.value)}
                className="w-full rounded-sm border border-white/10 bg-ink/40 px-3 py-1.5 text-sm text-cream outline-none focus:border-brass/50" />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={creatingChild}
              className="rounded-sm bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brassLight disabled:opacity-50">
              {creatingChild ? "Creating…" : "Create Subcategory"}
            </button>
            <button type="button" onClick={() => setAddingChild(false)} className="text-xs text-slate hover:text-cream">Cancel</button>
          </div>
        </form>
      )}

      {/* Children */}
      {expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              allCategories={allCategories}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setTree(data.tree ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateRoot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({
          name: newName,
          slug: slugify(newName),
          description: newDesc || undefined,
          parentId: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create."); return; }
      setNewName("");
      setNewDesc("");
      load();
    } finally {
      setCreating(false);
    }
  }

  // Flat list for move dropdowns
  function flattenTree(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
    return nodes.flatMap((n) => [
      { id: n.id, label: "—".repeat(depth) + " " + n.name },
      ...flattenTree(n.children, depth + 1),
    ]);
  }
  const allCategories = flattenTree(tree);

  // Count totals
  function countAll(nodes: CategoryNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0);
  }
  const totalCount = countAll(tree);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl text-cream">Categories</h1>
        <span className="text-xs text-slate/60">{totalCount} total</span>
      </div>
      <p className="mb-6 text-sm text-slate/60">
        Unlimited hierarchy — click <span className="text-brass">+ Sub</span> on any category to add a child.
      </p>

      {/* Add root category */}
      <form onSubmit={handleCreateRoot} className="mb-8 flex flex-wrap items-end gap-3 rounded-sm border border-white/[0.08] bg-surface p-5">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate">New Root Category</label>
          <input required value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Electronics"
            className="rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50" />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate">Description</label>
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional"
            className="rounded-sm border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream outline-none focus:border-brass/50" />
        </div>
        <button type="submit" disabled={creating}
          className="rounded-sm bg-brass px-4 py-2 text-sm font-semibold uppercase tracking-wider text-ink hover:bg-brassLight disabled:opacity-50">
          {creating ? "Creating…" : "Add Category"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-slate/50">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Active</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate/40" /> Inactive</span>
        <span>L0 = root level, L1 = child, L2 = grandchild, etc.</span>
      </div>

      {/* Tree */}
      {loading ? (
        <p className="text-sm text-slate">Loading...</p>
      ) : tree.length === 0 ? (
        <div className="rounded-sm border border-white/[0.08] bg-surface p-10 text-center">
          <p className="text-sm text-slate">No categories yet. Add your first root category above.</p>
        </div>
      ) : (
        <div className="rounded-sm border border-white/[0.08] bg-surface divide-y divide-white/[0.04]">
          {tree.map((node) => (
            <CategoryRow
              key={node.id}
              node={node}
              allCategories={allCategories}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}