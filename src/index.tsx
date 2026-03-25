import type { PluginFactory, PostRecord, SchemaField } from '@obieg-zero/sdk'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useState } = React
  const { Database } = icons

  function RecordForm({ schema, initial, onSubmit, onCancel }: {
    schema: SchemaField[]; initial?: Record<string, unknown>; onSubmit: (data: Record<string, unknown>) => void; onCancel?: () => void
  }) {
    const defaults: Record<string, unknown> = {}
    schema.forEach(f => { defaults[f.key] = initial?.[f.key] ?? '' })
    const [form, setForm] = useState(defaults)
    const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }))
    const complete = schema.filter(f => f.required).every(f => !!form[f.key])

    return (
      <ui.Stack>
        {schema.map(f => {
          if (f.inputType?.startsWith('select:')) {
            const refType = f.inputType.split(':')[1]
            const options = store.usePosts(refType).map((r: PostRecord) => ({ value: r.id, label: r.data.name || r.id }))
            return <ui.Field key={f.key} label={f.label} required={f.required}>
              {options.length > 0
                ? <ui.Select value={form[f.key]} options={[{ value: '', label: '— wybierz —' }, ...options]} onChange={(e: { target: { value: string } }) => set(f.key, e.target.value)} />
                : <ui.Input value={form[f.key]} onChange={(e: { target: { value: string } }) => set(f.key, e.target.value)} placeholder="Wpisz ręcznie" />}
            </ui.Field>
          }
          return <ui.Field key={f.key} label={f.label} required={f.required}>
            <ui.Input value={form[f.key]} type={f.inputType} onChange={(e: { target: { value: string } }) => set(f.key, e.target.value)} />
          </ui.Field>
        })}
        <ui.Row justify="end">
          {onCancel && <ui.Button size="xs" color="ghost" onClick={onCancel}>Anuluj</ui.Button>}
          <ui.Button size="xs" color="primary" onClick={() => onSubmit(form)} disabled={!complete}>{initial ? 'Zapisz' : 'Dodaj'}</ui.Button>
        </ui.Row>
      </ui.Stack>
    )
  }

  function CrudList({ type, schema, selectedId, onSelect, onAdd }: {
    type: string; schema: SchemaField[]; selectedId: string | null; onSelect: (id: string | null) => void; onAdd: () => void
  }) {
    const records = store.usePosts(type) as PostRecord[]
    const canParse = sdk.getParsers(type).length > 0

    const tableSchema = schema.slice(0, 3)
    const columns = tableSchema.map(f => ({ key: f.key, header: f.label }))
    const rows = records.map(r => {
      const row: Record<string, React.ReactNode> = {}
      for (const f of tableSchema) row[f.key] = String(r.data[f.key] ?? '')
      return { ...row, _id: r.id }
    })
    const activeRow = records.findIndex(r => r.id === selectedId)

    return (
      <ui.Stack>
        <ui.Row justify="between">
          <ui.Text muted size="xs">{records.length} rekordów</ui.Text>
          <ui.Row>
            <ui.Button size="xs" color="primary" onClick={onAdd}>+ Dodaj</ui.Button>
            {canParse && <ui.Button size="xs" color="ghost" onClick={() => importTyped(type)}>Import</ui.Button>}
          </ui.Row>
        </ui.Row>
        <ui.Table columns={columns} rows={rows} pageSize={20} empty="Brak danych"
          activeRow={activeRow >= 0 ? activeRow : undefined}
          onRowClick={i => onSelect(records[i]?.id ?? null)} />
      </ui.Stack>
    )
  }

  const useData = sdk.create(() => ({
    activeTab: null as string | null,
    selectedId: null as string | null,
    mode: 'list' as 'list' | 'add' | 'edit',
  }))

  function CrudView() {
    const { activeTab, selectedId, mode } = useData()

    const types = store.getTypes()
    const tabs = types.map(t => ({ type: t.type, label: t.label || t.type }))
    const tab = activeTab || tabs[0]?.type || null
    const typeDef = tab ? store.getType(tab) : null

    const selectTab = (type: string) => useData.setState({ activeTab: type, selectedId: null, mode: 'list' })

    return (
      <ui.Page><ui.Stack>
        {tabs.length > 0 && <ui.Tabs variant="lift" tabs={tabs.map(t => ({ id: t.type, label: t.label }))} active={tab || ''} onChange={selectTab} />}
        {tab && typeDef && <CrudList type={tab} schema={typeDef.schema} selectedId={selectedId}
          onSelect={id => useData.setState({ selectedId: id, mode: 'list' })} onAdd={() => useData.setState({ mode: 'add', selectedId: null })} />}
        {tab && typeDef && mode === 'add' && <RecordForm schema={typeDef.schema}
          onSubmit={data => { store.add(tab, data); useData.setState({ mode: 'list' }); sdk.log('Dodano rekord', 'ok') }}
          onCancel={() => useData.setState({ mode: 'list' })} />}
      </ui.Stack></ui.Page>
    )
  }

  function DetailPanel() {
    const { selectedId, mode, activeTab } = useData()
    const types = store.getTypes()
    const tabs = types.map(t => ({ type: t.type, label: t.label || t.type }))
    const tab = activeTab || tabs[0]?.type || null
    const typeDef = tab ? store.getType(tab) : null
    const records = store.usePosts(tab || '') as PostRecord[]
    const record = records.find(r => r.id === selectedId)

    if (!record || !typeDef) return <ui.Placeholder text="Wybierz rekord z tabeli" />

    if (mode === 'edit') {
      return (
        <ui.Box header={<ui.Cell label>Edycja</ui.Cell>} body={
          <RecordForm schema={typeDef.schema} initial={record.data as Record<string, unknown>}
            onSubmit={data => { store.update(record.id, data); useData.setState({ mode: 'list' }); sdk.log('Zapisano', 'ok') }}
            onCancel={() => useData.setState({ mode: 'list' })} />
        } />
      )
    }

    const nameKey = typeDef.schema.find(f => f.required)?.key || typeDef.schema[0]?.key
    const title = nameKey ? String(record.data[nameKey] ?? '') : record.id.slice(0, 8)
    const detailFields = typeDef.schema.filter(f => f.key !== nameKey)

    return (
      <ui.Page>
        <ui.StageLayout
          top={<>
            <ui.Text muted size="2xs">{new Date(record.createdAt).toLocaleDateString()}</ui.Text>
            <ui.Heading title={title} subtitle={typeDef.label} />
            <ui.Divider />
            {detailFields.map(f => {
              const val = record.data[f.key]
              if (!val && val !== 0) return null
              return <ui.Stack key={f.key} gap="sm">
                <ui.Text muted size="2xs">{f.label}</ui.Text>
                <ui.Text size="xs">{String(val)}</ui.Text>
                <ui.Divider />
              </ui.Stack>
            })}
          </>}
          bottom={<ui.Row justify="between">
            <ui.Button size="xs" color="error" outline onClick={async () => {
              store.remove(record.id)
              useData.setState({ selectedId: null })
              sdk.log('Usunięto rekord', 'ok')
            }}>Usuń</ui.Button>
            <ui.Button size="xs" color="primary" onClick={() => useData.setState({ mode: 'edit' })}>Edytuj</ui.Button>
          </ui.Row>}
        />
      </ui.Page>
    )
  }

  async function importTyped(type: string) {
    const parserDefs = sdk.getParsers(type)
    const parser = parserDefs[0]
    const file = await sdk.openFileDialog(parser?.accept || '.json')
    if (!file) return
    if (parser) {
      const data = parser.parse(await file.text())
      if (!data.length) { sdk.log('Brak danych w pliku', 'error'); return }
      const count = store.importJSON(data.map(d => ({ type, data: d as Record<string, unknown> })))
      sdk.log(`Zaimportowano ${count} rekordów`, 'ok')
    } else {
      try {
        const nodes = JSON.parse(await file.text())
        if (!Array.isArray(nodes)) { sdk.log('Oczekiwana tablica JSON', 'error'); return }
        const count = store.importJSON(nodes)
        sdk.log(`Zaimportowano ${count} rekordów`, 'ok')
      } catch (e: unknown) { sdk.log(`Błąd: ${e instanceof Error ? e.message : String(e)}`, 'error') }
    }
  }

  // Register contribution points
  sdk.registerView('data.center', { slot: 'center', component: CrudView })
  sdk.registerView('data.right', { slot: 'right', component: DetailPanel })

  return { id: 'data', label: 'Dane', icon: Database, version: '0.2.0' }
}

export default plugin
