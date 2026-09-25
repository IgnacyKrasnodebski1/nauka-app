"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/use-mounted";
import { Icon } from "@/components/ui/icons";

/**
 * Bottom panel (.sheet.a-rise) portalled into #app like legacy openSheet(): one at a time, Enter/Space press the
 * [data-primary] button, `back` adds the dimming backdrop (tap = onClose).
 */
export function Sheet({ kind, children, onClose, back = true, label }: { kind: string; children: ReactNode; onClose?: () => void; back?: boolean; label?: string }) {
  const mounted = useMounted();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape" && onClose) onClose();
      if (e.key === "Enter" || e.key === " ") {
        const b = document.querySelector<HTMLButtonElement>("#sheet [data-primary]");
        if (b) {
          e.preventDefault();
          b.click();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const host = mounted ? document.getElementById("app") : null;
  if (!host) return null;
  return createPortal(
    <>
      {back && <div className="sheetback" id="sheetback" onClick={onClose} />}
      <div className={`sheet a-rise ${kind}`} id="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </>,
    host,
  );
}

/** Handle + title + close (arkusze pełnej treści). */
export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose?: () => void }) {
  return (
    <>
      <div className="shandle" />
      <div className="shead">
        <div>
          <div className="st2">{title}</div>
          {sub && <div className="ssub">{sub}</div>}
        </div>
        {onClose && (
          <button type="button" className="backbtn sclose" aria-label="Zamknij" onClick={onClose}>
            <Icon name="close" size={18} stroke={3} />
          </button>
        )}
      </div>
    </>
  );
}
