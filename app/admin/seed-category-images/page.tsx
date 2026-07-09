"use client";

import { useState } from "react";
import { setCategoryImage } from "@/lib/actions";

// Temporary one-off tool: seeds the 6 AI-generated category tile photos into
// Supabase Storage + categories.image_url. Delete this route once used.
// URLs are filled in after each generation round.
const SEEDS: { id: string; url: string }[] = [
  { id: "skincare", url: "" },
  { id: "vitamins", url: "" },
  { id: "supplements", url: "" },
  { id: "hair", url: "" },
  { id: "personal", url: "" },
  { id: "devices", url: "" },
];

export default function SeedCategoryImagesPage() {
  const [status, setStatus] = useState<Record<string, string>>({});

  async function seedAll() {
    for (const s of SEEDS) {
      if (!s.url) {
        setStatus((prev) => ({ ...prev, [s.id]: "skipped (no url)" }));
        continue;
      }
      setStatus((prev) => ({ ...prev, [s.id]: "uploading..." }));
      try {
        await setCategoryImage(s.id, s.url);
        setStatus((prev) => ({ ...prev, [s.id]: "done" }));
      } catch (e) {
        setStatus((prev) => ({ ...prev, [s.id]: `error: ${e instanceof Error ? e.message : "unknown"}` }));
      }
    }
  }

  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-bold">Seed category images</h1>
      <button onClick={seedAll} className="mb-4 rounded bg-blue-600 px-4 py-2 text-white">
        Seed all 6
      </button>
      <ul className="flex flex-col gap-1">
        {SEEDS.map((s) => (
          <li key={s.id}>
            {s.id}: {status[s.id] ?? "pending"}
          </li>
        ))}
      </ul>
    </main>
  );
}
