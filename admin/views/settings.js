import { api } from "../api.js";
import { field, h, textInput, toast } from "../ui.js";

function formatWa(value) {
  const m = /^52(\d{3})(\d{3})(\d{4})$/.exec(value || "");
  return m ? `+52 ${m[1]} ${m[2]} ${m[3]}` : "formato no válido";
}

export function render(el, { store }) {
  const s = () => store.content.settings;

  const waPreview = h("span", { class: "field-hint" }, `Se verá como ${formatWa(s().whatsapp)}`);
  const wa = textInput({
    value: s().whatsapp, inputmode: "numeric", max: 12, placeholder: "522223303739",
    onInput: (v) => {
      const digits = v.replace(/\D/g, "");
      store.change((c) => { c.settings.whatsapp = digits; });
      waPreview.textContent = `Se verá como ${formatWa(digits)}`;
    },
  });
  const ga = textInput({ value: s().ga4, max: 24, placeholder: "G-XXXXXXXXXX", onInput: (v) => store.change((c) => { c.settings.ga4 = v.trim().toUpperCase(); }) });
  const px = textInput({ value: s().metaPixel, max: 20, placeholder: "Solo números", inputmode: "numeric", onInput: (v) => store.change((c) => { c.settings.metaPixel = v.replace(/\D/g, ""); }) });

  const current = textInput({ type: "password" });
  const next = textInput({ type: "password" });
  const again = textInput({ type: "password" });
  current.autocomplete = "current-password";
  next.autocomplete = "new-password";
  again.autocomplete = "new-password";
  const message = h("p", { class: "login-error", role: "alert" });
  const change = h("button", { class: "btn btn-primary", type: "button" }, "Cambiar contraseña");
  change.addEventListener("click", async () => {
    message.textContent = "";
    if (next.value !== again.value) { message.textContent = "Las contraseñas nuevas no coinciden."; return; }
    change.disabled = true;
    try {
      await api.changePassword(current.value, next.value);
      current.value = next.value = again.value = "";
      toast("Contraseña actualizada ✓");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      change.disabled = false;
    }
  });

  el.append(
    h("section", { class: "panel" },
      h("h2", {}, "Contacto y analítica"),
      h("div", { class: "form-grid" },
        field("WhatsApp principal", wa, { hint: "52 + 10 dígitos, sin espacios ni signos. Es el número de todos los botones de WhatsApp de la landing." }),
        h("div", {}, waPreview),
        field("Google Analytics (ID de medición)", ga, { hint: "Formato G-XXXXXXXXXX. Déjalo vacío para usar el actual." }),
        field("Pixel de Meta (ID)", px, { hint: "Opcional. Solo números." }))),
    h("section", { class: "panel" },
      h("h2", {}, "Contraseña del panel"),
      h("div", { class: "form-grid" },
        field("Contraseña actual", current), h("span", {}),
        field("Contraseña nueva", next, { hint: "Mínimo 10 caracteres." }), field("Repite la nueva", again)),
      message, h("div", { class: "row-actions" }, change)));
}
