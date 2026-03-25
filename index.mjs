import { jsx, jsxs, Fragment } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useState } = React;
  const { Database } = icons;
  function RecordForm({ schema, initial, onSubmit, onCancel }) {
    const defaults = {};
    schema.forEach((f) => {
      defaults[f.key] = (initial == null ? void 0 : initial[f.key]) ?? "";
    });
    const [form, setForm] = useState(defaults);
    const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
    const complete = schema.filter((f) => f.required).every((f) => !!form[f.key]);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      schema.map((f) => {
        var _a;
        if ((_a = f.inputType) == null ? void 0 : _a.startsWith("select:")) {
          const refType = f.inputType.split(":")[1];
          const options = store.usePosts(refType).map((r) => ({ value: r.id, label: r.data.name || r.id }));
          return /* @__PURE__ */ jsx(ui.Field, { label: f.label, required: f.required, children: options.length > 0 ? /* @__PURE__ */ jsx(ui.Select, { value: form[f.key], options: [{ value: "", label: "— wybierz —" }, ...options], onChange: (e) => set(f.key, e.target.value) }) : /* @__PURE__ */ jsx(ui.Input, { value: form[f.key], onChange: (e) => set(f.key, e.target.value), placeholder: "Wpisz ręcznie" }) }, f.key);
        }
        return /* @__PURE__ */ jsx(ui.Field, { label: f.label, required: f.required, children: /* @__PURE__ */ jsx(ui.Input, { value: form[f.key], type: f.inputType, onChange: (e) => set(f.key, e.target.value) }) }, f.key);
      }),
      /* @__PURE__ */ jsxs(ui.Row, { justify: "end", children: [
        onCancel && /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: onCancel, children: "Anuluj" }),
        /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => onSubmit(form), disabled: !complete, children: initial ? "Zapisz" : "Dodaj" })
      ] })
    ] });
  }
  function CrudList({ type, schema, selectedId, onSelect, onAdd }) {
    const records = store.usePosts(type);
    const canParse = sdk.getParsers(type).length > 0;
    const tableSchema = schema.slice(0, 3);
    const columns = tableSchema.map((f) => ({ key: f.key, header: f.label }));
    const rows = records.map((r) => {
      const row = {};
      for (const f of tableSchema) row[f.key] = String(r.data[f.key] ?? "");
      return { ...row, _id: r.id };
    });
    const activeRow = records.findIndex((r) => r.id === selectedId);
    return /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
          records.length,
          " rekordów"
        ] }),
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: onAdd, children: "+ Dodaj" }),
          canParse && /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "ghost", onClick: () => importTyped(type), children: "Import" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        ui.Table,
        {
          columns,
          rows,
          pageSize: 20,
          empty: "Brak danych",
          activeRow: activeRow >= 0 ? activeRow : void 0,
          onRowClick: (i) => {
            var _a;
            return onSelect(((_a = records[i]) == null ? void 0 : _a.id) ?? null);
          }
        }
      )
    ] });
  }
  const useData = sdk.create(() => ({
    activeTab: null,
    selectedId: null,
    mode: "list"
  }));
  function CrudView() {
    var _a;
    const { activeTab, selectedId, mode } = useData();
    const types = store.getTypes();
    const tabs = types.map((t) => ({ type: t.type, label: t.label || t.type }));
    const tab = activeTab || ((_a = tabs[0]) == null ? void 0 : _a.type) || null;
    const typeDef = tab ? store.getType(tab) : null;
    const selectTab = (type) => useData.setState({ activeTab: type, selectedId: null, mode: "list" });
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      tabs.length > 0 && /* @__PURE__ */ jsx(ui.Tabs, { variant: "lift", tabs: tabs.map((t) => ({ id: t.type, label: t.label })), active: tab || "", onChange: selectTab }),
      tab && typeDef && /* @__PURE__ */ jsx(
        CrudList,
        {
          type: tab,
          schema: typeDef.schema,
          selectedId,
          onSelect: (id) => useData.setState({ selectedId: id, mode: "list" }),
          onAdd: () => useData.setState({ mode: "add", selectedId: null })
        }
      ),
      tab && typeDef && mode === "add" && /* @__PURE__ */ jsx(
        RecordForm,
        {
          schema: typeDef.schema,
          onSubmit: (data) => {
            store.add(tab, data);
            useData.setState({ mode: "list" });
            sdk.log("Dodano rekord", "ok");
          },
          onCancel: () => useData.setState({ mode: "list" })
        }
      )
    ] }) });
  }
  function DetailPanel() {
    var _a, _b, _c;
    const { selectedId, mode, activeTab } = useData();
    const types = store.getTypes();
    const tabs = types.map((t) => ({ type: t.type, label: t.label || t.type }));
    const tab = activeTab || ((_a = tabs[0]) == null ? void 0 : _a.type) || null;
    const typeDef = tab ? store.getType(tab) : null;
    const records = store.usePosts(tab || "");
    const record = records.find((r) => r.id === selectedId);
    if (!record || !typeDef) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz rekord z tabeli" });
    if (mode === "edit") {
      return /* @__PURE__ */ jsx(ui.Box, { header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Edycja" }), body: /* @__PURE__ */ jsx(
        RecordForm,
        {
          schema: typeDef.schema,
          initial: record.data,
          onSubmit: (data) => {
            store.update(record.id, data);
            useData.setState({ mode: "list" });
            sdk.log("Zapisano", "ok");
          },
          onCancel: () => useData.setState({ mode: "list" })
        }
      ) });
    }
    const nameKey = ((_b = typeDef.schema.find((f) => f.required)) == null ? void 0 : _b.key) || ((_c = typeDef.schema[0]) == null ? void 0 : _c.key);
    const title = nameKey ? String(record.data[nameKey] ?? "") : record.id.slice(0, 8);
    const detailFields = typeDef.schema.filter((f) => f.key !== nameKey);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(
      ui.StageLayout,
      {
        top: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: new Date(record.createdAt).toLocaleDateString() }),
          /* @__PURE__ */ jsx(ui.Heading, { title, subtitle: typeDef.label }),
          /* @__PURE__ */ jsx(ui.Divider, {}),
          detailFields.map((f) => {
            const val = record.data[f.key];
            if (!val && val !== 0) return null;
            return /* @__PURE__ */ jsxs(ui.Stack, { gap: "sm", children: [
              /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "2xs", children: f.label }),
              /* @__PURE__ */ jsx(ui.Text, { size: "xs", children: String(val) }),
              /* @__PURE__ */ jsx(ui.Divider, {})
            ] }, f.key);
          })
        ] }),
        bottom: /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "error", outline: true, onClick: async () => {
            store.remove(record.id);
            useData.setState({ selectedId: null });
            sdk.log("Usunięto rekord", "ok");
          }, children: "Usuń" }),
          /* @__PURE__ */ jsx(ui.Button, { size: "xs", color: "primary", onClick: () => useData.setState({ mode: "edit" }), children: "Edytuj" })
        ] })
      }
    ) });
  }
  async function importTyped(type) {
    const parserDefs = sdk.getParsers(type);
    const parser = parserDefs[0];
    const file = await sdk.openFileDialog((parser == null ? void 0 : parser.accept) || ".json");
    if (!file) return;
    if (parser) {
      const data = parser.parse(await file.text());
      if (!data.length) {
        sdk.log("Brak danych w pliku", "error");
        return;
      }
      const count = store.importJSON(data.map((d) => ({ type, data: d })));
      sdk.log(`Zaimportowano ${count} rekordów`, "ok");
    } else {
      try {
        const nodes = JSON.parse(await file.text());
        if (!Array.isArray(nodes)) {
          sdk.log("Oczekiwana tablica JSON", "error");
          return;
        }
        const count = store.importJSON(nodes);
        sdk.log(`Zaimportowano ${count} rekordów`, "ok");
      } catch (e) {
        sdk.log(`Błąd: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    }
  }
  sdk.registerView("data.center", { slot: "center", component: CrudView });
  sdk.registerView("data.right", { slot: "right", component: DetailPanel });
  return { id: "data", label: "Dane", icon: Database, version: "0.2.0" };
};
export {
  plugin as default
};
