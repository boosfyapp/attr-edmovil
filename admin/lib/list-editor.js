/* Editor genérico de listas: tarjetas colapsables con campos tipados, reordenar, duplicar y eliminar. */
import { confirmDialog, field, h, numberInput, select, textArea, textInput, toast, toggle } from "../ui.js";
import { pickAndUpload } from "./image-upload.js";

function imageField(item, f, onChange, rerender) {
  const wrap = h("div", { class: "image-field" });
  const draw = () => {
    wrap.replaceChildren(
      item[f.key] ? h("img", { class: "thumb", src: `/${item[f.key]}`, alt: "" }) : h("div", { class: "thumb thumb-empty" }, "Sin foto"),
      h("button", {
        class: "btn btn-small", type: "button",
        onclick: async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = "Subiendo…";
          try {
            const path = await pickAndUpload();
            if (path) { item[f.key] = path; onChange(); rerender?.(); }
          } catch (error) {
            toast(error.message, "error");
          } finally {
            draw();
          }
        },
      }, item[f.key] ? "Cambiar foto" : "Subir foto"));
  };
  draw();
  return wrap;
}

function inputFor(item, f, onChange, rerender) {
  const set = (value) => { item[f.key] = value; onChange(); };
  switch (f.type) {
    case "number": case "money":
      return numberInput({ value: item[f.key], onInput: set, placeholder: f.placeholder, min: f.min ?? 0 });
    case "textarea":
      return textArea({ value: item[f.key], onInput: set, max: f.max, rows: f.rows ?? 3 });
    case "toggle":
      return toggle({ checked: Boolean(item[f.key]), onChange: set, label: f.toggleLabel });
    case "date": {
      const input = h("input", { type: "date", value: item[f.key] || "" });
      input.addEventListener("input", () => set(input.value));
      return input;
    }
    case "select":
      return select({ value: item[f.key], options: f.options, onChange: set });
    case "image":
      return imageField(item, f, onChange, rerender);
    case "custom":
      return f.render(item, onChange, rerender);
    default:
      return textInput({ value: item[f.key], onInput: set, max: f.max, placeholder: f.placeholder, type: f.type === "url" ? "url" : "text" });
  }
}

/**
 * @param {object} o
 * @param {object[]} o.items         arreglo que se edita en sitio (referencia al contenido del store)
 * @param {object[]} o.fields        [{key,label,type,hint,span}]
 * @param {(item,index)=>string} o.title
 * @param {(item,index)=>(Node|string)} [o.summary]  texto secundario de la cabecera
 * @param {(item,index)=>Node} [o.badge]
 * @param {()=>object} o.newItem
 * @param {()=>void} o.onChange      llamar tras cualquier cambio (dispara el guardado)
 * @param {string} [o.addLabel]
 * @param {boolean} [o.reorder]
 * @param {(item,index)=>(Node|null)} [o.thumb]
 * @param {number} [o.min]           mínimo de elementos (impide eliminar por debajo)
 * @param {boolean} [o.filter]       muestra buscador por título
 */
export function listEditor(o) {
  const root = h("div", { class: "list-editor" });
  const open = new Set();
  let query = "";

  function render() {
    root.replaceChildren();
    if (o.filter) {
      root.append(h("input", {
        class: "list-filter", type: "search", placeholder: "Buscar…", value: query,
        oninput: (e) => { query = e.target.value.toLowerCase(); renderCards(); },
      }));
    }
    const cards = h("div", { class: "cards" });
    root.append(cards, h("button", {
      class: "btn btn-primary btn-add", type: "button",
      onclick: () => { o.items.push(o.newItem()); open.add(o.items[o.items.length - 1]); o.onChange(); render(); },
    }, `+ ${o.addLabel || "Agregar"}`));
    root.cards = cards;
    renderCards();
  }

  function renderCards() {
    const cards = root.cards;
    cards.replaceChildren();
    const visible = o.items.map((item, index) => ({ item, index })).filter(({ item, index }) => !query || String(o.title(item, index)).toLowerCase().includes(query));
    if (!visible.length) cards.append(h("p", { class: "empty" }, o.items.length ? "Nada coincide con la búsqueda." : "Todavía no hay elementos."));
    for (const { item, index } of visible) cards.append(card(item, index));
  }

  function card(item, index) {
    const isOpen = open.has(item);
    const body = h("div", { class: "card-body" }, o.fields.map((f) =>
      field(f.label, inputFor(item, f, o.onChange, () => renderCards()), { hint: f.hint, className: f.span === 2 ? "span-2" : "" })));
    const titleEl = h("strong", {}, o.title(item, index));
    const summaryEl = h("span", { class: "card-summary" }, o.summary?.(item, index) ?? "");
    const badgeSlot = h("span", { class: "card-badge" }, o.badge?.(item, index) ?? "");
    const updateHead = () => {
      titleEl.textContent = o.title(item, index);
      summaryEl.replaceChildren(o.summary?.(item, index) ?? "");
      badgeSlot.replaceChildren(o.badge?.(item, index) ?? "");
    };
    // el título/resumen se refresca al editar cualquier campo
    body.addEventListener("input", updateHead);
    body.addEventListener("change", updateHead);

    const move = (delta) => {
      const target = index + delta;
      if (target < 0 || target >= o.items.length) return;
      [o.items[index], o.items[target]] = [o.items[target], o.items[index]];
      o.onChange();
      renderCards();
    };
    const head = h("div", { class: "card-head" },
      h("button", { class: "card-toggle", type: "button", "aria-expanded": String(isOpen), onclick: () => { isOpen ? open.delete(item) : open.add(item); renderCards(); } },
        o.thumb?.(item, index) ?? null,
        h("span", { class: "card-title" }, titleEl, summaryEl),
        badgeSlot,
        h("span", { class: "chev", "aria-hidden": "true" }, isOpen ? "▾" : "▸")),
      h("div", { class: "card-actions" },
        o.reorder === false ? null : [
          h("button", { class: "icon-btn", type: "button", title: "Subir", "aria-label": "Subir", onclick: () => move(-1) }, "↑"),
          h("button", { class: "icon-btn", type: "button", title: "Bajar", "aria-label": "Bajar", onclick: () => move(1) }, "↓"),
        ],
        h("button", {
          class: "icon-btn", type: "button", title: "Duplicar", "aria-label": "Duplicar",
          onclick: () => {
            const copy = structuredClone(item);
            if ("id" in copy) copy.id = `${copy.id}-copia`;
            o.items.splice(index + 1, 0, copy);
            open.add(copy);
            o.onChange();
            renderCards();
          },
        }, "⧉"),
        h("button", {
          class: "icon-btn icon-danger", type: "button", title: "Eliminar", "aria-label": "Eliminar",
          onclick: async () => {
            if (o.min !== undefined && o.items.length <= o.min) return toast(`Debe quedar al menos ${o.min} elemento(s).`, "error");
            if (!(await confirmDialog("Eliminar", `¿Eliminar «${o.title(item, index)}»? Podrás recuperarlo restaurando una versión publicada si ya estaba publicado.`, { confirm: "Eliminar", kind: "danger" }))) return;
            o.items.splice(index, 1);
            o.onChange();
            renderCards();
          },
        }, "🗑")));
    return h("article", { class: `card${isOpen ? " is-open" : ""}` }, head, isOpen ? body : null);
  }

  render();
  return root;
}
