import { Children, Fragment, isValidElement, type ReactNode } from "react";

export function normalizeLocalizedTabContent(content: ReactNode): ReactNode[] {
  return Children.toArray(content).flatMap((child): ReactNode[] => {
    if (isValidElement(child) && child.type === Fragment) {
      return normalizeLocalizedTabContent((child.props as { children?: ReactNode }).children);
    }

    return [child];
  });
}
