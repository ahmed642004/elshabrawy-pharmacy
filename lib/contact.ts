// Public contact details for the pharmacy — used by the WhatsApp buttons,
// the Contact page, the footer, and the checkout "outside delivery area"
// notice. Single source so the number lives in exactly one place.

// E.164 without the leading "+" (Egypt +20, mobile 010…), the form wa.me
// expects. Source number: 010 9929 0594.
export const WHATSAPP_NUMBER = "201099290594";

// Human-readable forms.
export const PHONE_DISPLAY = "010 9929 0594";
export const PHONE_LINK = "+201099290594";

// wa.me deep link, optionally with a prefilled first message. Callers pass a
// localized string so the chat opens in the customer's language.
export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
