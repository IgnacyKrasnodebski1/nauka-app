"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { loadLibrary } from "@/lib/client-data";
import { useUi } from "@/components/app/chrome";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icons";

/**
 * „Dodaj materiał” (QuickAdd.html) from every screen (design/DESIGN.md §0): photo → upload flow with camera capture,
 * file → upload, text → paste flow, "Mam sprawdzian" → TestPlan sheet, catalogue link. When the account has no subject
 * yet the flow opens the catalogue (a subject is the container a topic is generated into).
 */
export function QuickAddSheet() {
  const { closeSheet, openTestSheet } = useUi();
  const { supabase, user } = useApp();
  const router = useRouter();
  const [subjectId, setSubjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    loadLibrary(supabase, user.id).then((lib) => setSubjectId(lib.subjects[0]?.id ?? null));
  }, [supabase, user.id]);
  const go = (mode: "photo" | "file" | "text") => {
    closeSheet();
    if (subjectId === null) return router.push("/app/catalog?add=1");
    router.push(subjectId ? `/app/s/${subjectId}/new?mode=${mode}&pick=1` : `/app/catalog?add=1`);
  };
  return (
    <Sheet kind="quickadd" onClose={closeSheet} label="Dodaj materiał">
      <div className="shandle" />
      <div className="shead">
        <div className="st2">Dodaj materiał</div>
        <button type="button" className="backbtn sclose" aria-label="Zamknij" onClick={closeSheet}><Icon name="close" size={18} stroke={3} /></button>
      </div>
      <button type="button" className="qabig a-pop" onClick={() => go("photo")}>
        <div className="ico a-bob"><Icon name="camera" size={32} stroke={2.4} /></div>
        <div className="grow"><div className="t">Zrób zdjęcie</div><div className="s">strona z podręcznika, zeszyt, tablica</div></div>
      </button>
      <div className="qagrid">
        <button type="button" className="qatile pink a-up d1" onClick={() => go("file")}>
          <Icon name="upload" size={24} stroke={2.6} />
          <div><div className="t">Wgraj plik</div><div className="s">PDF, zdjęcia, tekst</div></div>
        </button>
        <button type="button" className="qatile cyan a-up d2" onClick={() => go("text")}>
          <Icon name="list" size={24} stroke={2.6} />
          <div><div className="t">Wklej tekst</div><div className="s">notatki, konspekt, zagadnienia</div></div>
        </button>
      </div>
      <button type="button" className="qatest a-up d3" onClick={() => openTestSheet(subjectId ?? null)}>
        <Icon name="calendar" size={20} stroke={2.4} />
        <span>Mam sprawdzian — ułóż mi plan</span>
        <Icon name="chevron-right" size={18} stroke={2.6} className="chev" />
      </button>
      <button type="button" className="qalink a-up d4" data-primary onClick={() => { closeSheet(); router.push("/app/catalog"); }}>
        albo weź gotowy przedmiot z katalogu
      </button>
    </Sheet>
  );
}
