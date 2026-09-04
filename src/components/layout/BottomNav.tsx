import React, { type CSSProperties, type RefObject } from "react";

export type BottomNavKey = "home" | "add" | "inventory" | "history";

interface BottomNavProps {
  view: string;
  isAddingNew?: boolean;
  onHome: () => void;
  onAdd: () => void;
  onInventory: () => void;
  onHistory?: () => void;
  onLogs?: () => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

/* Custom Premium Thin Icons with dynamic active stroke and subtle fill */
function PremiumHomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.05 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-[22px] h-[22px] transition-[stroke-width] duration-200"
    >
      <path
        d="
          M5 10.2
          12 4.5
          19 10.2
          V18.5
          A1.3 1.3 0 0 1
          17.7 19.8
          H6.3
          A1.3 1.3 0 0 1
          5 18.5
          Z
        "
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.08 : 0}
      />
      <path
        d="
          M10 19.8
          V14.8
          H14
          V19.8
        "
      />
    </svg>
  );
}

function PremiumPlusIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.05 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`w-[22px] h-[22px] transition-all duration-200 ${
        active ? "scale-[1.04]" : "scale-100"
      }`}
    >
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </svg>
  );
}

function PremiumInventoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.05 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-[22px] h-[22px] transition-[stroke-width] duration-200"
    >
      <path
        className="inventory-layer inventory-layer-top"
        d="m5 8 7-3.8L19 8l-7 3.8z"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.08 : 0}
      />
      <path
        className="inventory-layer inventory-layer-middle"
        d="m5 12 7 3.8 7-3.8"
      />
      <path
        className="inventory-layer inventory-layer-bottom"
        d="m5 16 7 3.8 7-3.8"
      />
    </svg>
  );
}

function PremiumHistoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.05 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-[22px] h-[22px] transition-[stroke-width] duration-200"
    >
      <path
        d="
          M5 7.5
          A8.2 8.2 0 1 1
          4 14.2
        "
      />
      <path
        d="
          M5 4.6
          V7.6
          H8
        "
      />
      <path
        d="
          M12 8
          V12
          L14.7 13.7
        "
      />
    </svg>
  );
}

const activePosition: Record<BottomNavKey, number> = {
  home: 0,
  add: 1,
  inventory: 2,
  history: 3,
};

export default function BottomNav({
  view,
  isAddingNew = false,
  onHome,
  onAdd,
  onInventory,
  onHistory,
  onLogs,
  scrollContainerRef,
}: BottomNavProps) {
  // Single activeKey ensuring only ONE active tab at any time
  const activeKey: BottomNavKey | null = isAddingNew
    ? "add"
    : view === "dashboard"
    ? "home"
    : view === "inventory"
    ? "inventory"
    : view === "logs"
    ? "history"
    : null;

  const currentPosition = activeKey !== null ? activePosition[activeKey] : 0;
  const handleHistoryAction = onHistory || onLogs || (() => {});
  const executeTap = (_key: BottomNavKey, action: () => void) => {
    action();
  };

  const classFor = (key: BottomNavKey) => {
    return [
      "liquid-nav-item",
      `nav-${key}`,
      activeKey === key ? "liquid-nav-item-active" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const navStyle = {
    "--active-index": currentPosition,
  } as CSSProperties;

  return (
    <nav
      dir="rtl"
      aria-label="التنقل الرئيسي"
      className="liquid-bottom-nav"
    >
      <div className="liquid-bottom-nav-glass" style={navStyle}>
        {/* Persistent Instagram-style sliding Active Capsule */}
        {activeKey !== null && (
          <div
            aria-hidden="true"
            className="liquid-indicator-slot"
          >
            <div className="instagram-nav-indicator" />
          </div>
        )}

        {/* 1. الرئيسية (Home) - RTL Index 0 */}
        <button
          type="button"
          aria-label="الرئيسية"
          aria-current={activeKey === "home" ? "page" : undefined}
          className={classFor("home")}
          onClick={() => executeTap("home", onHome)}
        >
          <PremiumHomeIcon active={activeKey === "home"} />
        </button>

        {/* 2. إضافة صنف جديد (Plus) - RTL Index 1 */}
        <button
          type="button"
          aria-label="إضافة صنف جديد"
          aria-current={activeKey === "add" ? "page" : undefined}
          className={classFor("add")}
          onClick={() => executeTap("add", onAdd)}
        >
          <PremiumPlusIcon active={activeKey === "add"} />
        </button>

        {/* 3. المخزون (Inventory Layers) - RTL Index 2 */}
        <button
          type="button"
          aria-label="المخزون"
          aria-current={activeKey === "inventory" ? "page" : undefined}
          className={classFor("inventory")}
          onClick={() => executeTap("inventory", onInventory)}
        >
          <PremiumInventoryIcon active={activeKey === "inventory"} />
        </button>

        {/* 4. السجل (History) - RTL Index 3 */}
        <button
          type="button"
          aria-label="السجل"
          aria-current={activeKey === "history" ? "page" : undefined}
          className={classFor("history")}
          onClick={() => executeTap("history", handleHistoryAction)}
        >
          <PremiumHistoryIcon active={activeKey === "history"} />
        </button>
      </div>
    </nav>
  );
}
