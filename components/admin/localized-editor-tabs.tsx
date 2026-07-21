"use client";

import { useId, useState, type ReactNode } from "react";
import { normalizeLocalizedTabContent } from "@/lib/admin/localized-tab-content";
import { cn } from "@/lib/utils/cn";

type LocaleTab = {
  key: string;
  label: string;
  complete?: boolean;
  description?: string;
  content: ReactNode;
};

export function LocalizedEditorTabs({
  tabs,
  defaultTab,
}: Readonly<{
  tabs: LocaleTab[];
  defaultTab?: string;
}>) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? "");
  const tabListId = useId();

  return (
    <div className="space-y-4">
      <div aria-label="Idiomas" className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const panelId = `${tabListId}-${tab.key}-panel`;
          const tabId = `${tabListId}-${tab.key}-tab`;

          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]",
                isActive
                  ? "border-[color:var(--admin-accent)] bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]"
                  : "border-[color:var(--admin-border)] bg-white text-[color:var(--admin-foreground)] hover:bg-[color:var(--admin-surface-muted)]",
              )}
              id={tabId}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                tab.complete
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900",
              )}>
                {tab.complete ? "Completo" : "Pendiente"}
              </span>
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const panelId = `${tabListId}-${tab.key}-panel`;
        const tabId = `${tabListId}-${tab.key}-tab`;

        return (
          <div
            aria-labelledby={tabId}
            className={cn("space-y-4", !isActive && "hidden")}
            id={panelId}
            key={tab.key}
            role="tabpanel"
          >
            {tab.description ? <p className="text-sm text-[color:var(--admin-muted-foreground)]">{tab.description}</p> : null}
            {normalizeLocalizedTabContent(tab.content)}
          </div>
        );
      })}
    </div>
  );
}
