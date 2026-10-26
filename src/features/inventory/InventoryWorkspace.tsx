import React, { useEffect, useRef } from "react";
import {
  ChevronLeft,
  FolderCog,
  List,
  MoveHorizontal,
  Plus,
  Printer,
} from "lucide-react";
import type { Category, Tile } from "@/types";
import SearchFilter from "./SearchFilter";
import VoiceAddButton from "@/features/voice/VoiceAddButton";
import SummaryCards from "@/features/dashboard/SummaryCards";

interface Props {
  categories: Category[];
  category: Category;
  tiles: Tile[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectCategory: (id: string) => void;
  onShowAll: () => void;
  onAdd: () => void;
  onVoiceAdd?: () => void;
  userId?: string;
  onPrint: () => void;
  onManageCategories?: () => void;
  children: React.ReactNode;
}

export default function InventoryWorkspace({
  categories,
  category,
  tiles,
  searchQuery,
  onSearchChange,
  onSelectCategory,
  onShowAll,
  onAdd,
  onPrint,
  onManageCategories,
  onVoiceAdd,
  userId,
  children,
}: Props) {
  const actionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const details = actionsRef.current;
      if (details?.open && !details.contains(event.target as Node))
        details.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const run = (action: () => void) => {
    if (actionsRef.current) actionsRef.current.open = false;
    action();
  };

  return (
    <section
      className="stock-workspace"
      dir="rtl"
      aria-label={`مخزون ${category.name}`}
    >
      <div className="stock-summary">
        <SummaryCards
          tiles={tiles}
          activeCategoryId={category.id}
          unitType={category.defaultUnit}
        />
      </div>
      <div className="stock-controls no-print">
        <SearchFilter
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
        {onVoiceAdd && (
          <VoiceAddButton compact onClick={onVoiceAdd} userId={userId} />
        )}
        <details
          ref={actionsRef}
          className="stock-options"
          onKeyDown={(event) => {
            if (event.key === "Escape" && actionsRef.current?.open) {
              event.stopPropagation();
              actionsRef.current.open = false;
              actionsRef.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="خيارات القسم">
            <Plus size={23} strokeWidth={1.7} />
          </summary>
          <div className="stock-options-panel" aria-label="إجراءات القسم">
            <button type="button" onClick={() => run(onAdd)}>
              <Plus size={18} />
              إضافة صنف لهذا القسم
            </button>
            <button type="button" onClick={() => run(onShowAll)}>
              <List size={18} />
              عرض المخزون الكامل
            </button>
            <button type="button" onClick={() => run(onPrint)}>
              <Printer size={18} />
              طباعة وتصدير
            </button>
            {onManageCategories && (
              <button type="button" onClick={() => run(onManageCategories)}>
                <FolderCog size={18} />
                إدارة الأقسام
              </button>
            )}
          </div>
        </details>
      </div>
      <div className="stock-register" id="print-area" key={category.id}>
        {children}
      </div>
      <div className="stock-register-footer no-print">
        <span>
          <MoveHorizontal size={15} strokeWidth={1.5} />
          اسحب الصنف لإظهار الإجراءات
        </span>
        <button type="button" onClick={onShowAll}>
          عرض الكل
          <ChevronLeft size={15} />
        </button>
      </div>
    </section>
  );
}
