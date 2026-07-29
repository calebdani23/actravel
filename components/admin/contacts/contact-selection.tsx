"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type SelectionContextValue = Readonly<{
  selected: readonly string[];
  toggle: (id: string, checked: boolean) => void;
  selectPage: (checked: boolean) => void;
  clear: () => void;
}>;

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useContactSelectionContext() {
  return useContext(SelectionContext);
}

export function ContactSelection(props: Readonly<{ ids: readonly string[]; children: ReactNode; selectAllLabel?: string }>) {
  return <ContactSelectionScope key={JSON.stringify(props.ids)} {...props} />;
}

function ContactSelectionScope({ ids, children, selectAllLabel = "Seleccionar todos los contactos visibles" }: Readonly<{ ids: readonly string[]; children: ReactNode; selectAllLabel?: string }>) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const toggle = (id: string, checked: boolean) => setSelected((current) => checked ? current.includes(id) ? current : [...current, id] : current.filter((item) => item !== id));
  const selectPage = (checked: boolean) => setSelected(checked ? [...ids] : []);
  const clear = () => setSelected([]);

  return <SelectionContext.Provider value={{ selected, toggle, selectPage, clear }}><div className="space-y-3"><div className="flex items-center gap-3"><label className="inline-flex items-center gap-2 text-sm"><input aria-label={selectAllLabel} checked={allSelected} onChange={(event) => selectPage(event.target.checked)} type="checkbox" /> Seleccionar página</label>{selected.length ? <Button onClick={clear} size="sm" type="button" variant="outline">Limpiar selección ({selected.length})</Button> : null}</div>{children}</div></SelectionContext.Provider>;
}

export function SelectableRow({ id, label = "Seleccionar fila" }: Readonly<{ id: string; label?: string }>) {
  const selection = useContactSelectionContext();
  if (!selection) throw new Error("SelectableRow must be rendered inside ContactSelection.");

  return <input aria-label={label} checked={selection.selected.includes(id)} onChange={(event) => selection.toggle(id, event.target.checked)} type="checkbox" />;
}
