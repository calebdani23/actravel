export const TEMPLATE_FEEDBACK_FOCUS = "feedback";

export function buildTemplateRedirectTarget(feedback: { status: "success" | "error"; message: string; focus?: boolean }) {
  const params = new URLSearchParams({ status: feedback.status, message: feedback.message });
  if (feedback.focus) params.set("focus", TEMPLATE_FEEDBACK_FOCUS);
  return `/admin/templates?${params.toString()}`;
}

export function isTemplateFeedbackFocus(value?: string | null) {
  return value === TEMPLATE_FEEDBACK_FOCUS;
}
