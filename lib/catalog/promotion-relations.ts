export type PromotionServiceRelationLike = {
  service_id?: string | null;
};

export type PromotionRelationLike = {
  destination_id?: string | null;
  package_id?: string | null;
  service_id?: string | null;
  service_ids?: Array<string | null> | null;
  promotion_services?: Array<PromotionServiceRelationLike | null> | null;
};

export function resolvePromotionServiceIds(input: PromotionRelationLike) {
  const values = [
    input.service_id,
    ...(input.service_ids ?? []),
    ...((input.promotion_services ?? []).map((relation) => relation?.service_id ?? null)),
  ];

  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function promotionsShareRelation(a: PromotionRelationLike, b: PromotionRelationLike) {
  const aServiceIds = new Set(resolvePromotionServiceIds(a));
  const bServiceIds = resolvePromotionServiceIds(b);

  return (a.destination_id && a.destination_id === b.destination_id)
    || (a.package_id && a.package_id === b.package_id)
    || bServiceIds.some((serviceId) => aServiceIds.has(serviceId));
}
