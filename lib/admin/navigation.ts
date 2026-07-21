export type AdminSearchParams = Record<string, string | string[] | undefined>;

function appendParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (!value) return;
  params.append(key, value);
}

export function buildAdminSearchQueryString(searchParams: AdminSearchParams) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) appendParam(params, key, value);
      continue;
    }

    appendParam(params, key, rawValue);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function appendAdminSearchParams(pathname: string, searchParams: AdminSearchParams) {
  return `${pathname}${buildAdminSearchQueryString(searchParams)}`;
}
