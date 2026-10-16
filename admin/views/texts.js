import { h, textArea, textInput } from "../ui.js";

export function render(el, { store }) {
  const { texts: schema, sections } = store.schema;
  const overrides = () => store.content.texts;
  const current = (item) => (item.key in overrides() ? overrides()[item.key] : item.default);
  let query = "";
  const openSections = new Set([sections[0]]);

  const list = h("div", { class: "sections" });
  const search = h("input", {
    class: "list-filter", type: "search", placeholder: "Buscar un texto (ej. «domicilio», «portabilidad»)…",
    oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); },
  });

  function setValue(item, value, counter, resetBtn, tag) {
    store.change((c) => {
      if (value === item.default) delete c.texts[item.key];
      else c.texts[item.key] = value;
    });
    const changed = item.key in overrides();
    counter.textContent = `${value.length} caracteres`;
    resetBtn.hidden = !changed;
    tag.hidden = !changed;
  }

  function row(item) {
    const changed = item.key in overrides();
    const counter = h("span", { class: "counter" }, `${current(item).length} caracteres`);
    const tag = h("span", { class: "tag-changed", hidden: !changed }, "modificado");
    const reset = h("button", { class: "link-btn", type: "button", hidden: !changed }, "Restaurar original");
    const input = item.long
      ? textArea({ value: current(item), rows: current(item).length > 140 ? 4 : 3, onInput: (v) => setValue(item, v, counter, reset, tag) })
      : textInput({ value: current(item), onInput: (v) => setValue(item, v, counter, reset, tag) });
    reset.addEventListener("click", () => {
      input.value = item.default;
      setValue(item, item.default, counter, reset, tag);
    });
    return h("div", { class: "text-row" },
      h("div", { class: "text-row-head" }, h("span", { class: "field-label" }, item.label), tag, reset),
      input,
      h("div", { class: "text-row-foot" }, counter, item.attr === "data-wa-text" ? h("span", { class: "muted" }, "Mensaje que se envía al abrir WhatsApp") : null));
  }

  function draw() {
    list.replaceChildren();
    for (const section of sections) {
      const items = schema.filter((t) => t.section === section && (!query || t.label.toLowerCase().includes(query) || current(t).toLowerCase().includes(query)));
      if (!items.length) continue;
      const isOpen = Boolean(query) || openSections.has(section);
      const changedCount = items.filter((t) => t.key in overrides()).length;
      const head = h("button", {
        class: "accordion-head", type: "button", "aria-expanded": String(isOpen),
        onclick: () => { isOpen ? openSections.delete(section) : openSections.add(section); draw(); },
      }, h("span", {}, isOpen ? "▾" : "▸", " ", section), h("span", { class: "muted" }, changedCount ? `${changedCount} modificado(s) · ` : "", `${items.length} textos`));
      list.append(h("section", { class: "accordion" }, head, isOpen ? h("div", { class: "accordion-body" }, items.map(row)) : null));
    }
    if (!list.children.length) list.append(h("p", { class: "empty" }, "Ningún texto coincide con la búsqueda."));
  }

  el.append(
    h("p", { class: "lead" }, "Aquí cambias los textos de la landing. Para poner algo en negritas, escríbelo entre dos asteriscos dobles: ", h("code", {}, "**así**"), "."),
    search, list);
  draw();
}
