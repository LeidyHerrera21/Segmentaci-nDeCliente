import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import type { Customer, SegmentationSummary } from "./types";
import { loadCustomers, saveCustomers } from "./services/customerService";
import { runKMeans } from "./services/segmentationService";
import { validateCustomer, type CustomerInput } from "./utils/validation";

type Page = "dashboard" | "customers" | "segmentation" | "recommendations";
const COLORS = ["#2463eb", "#06a6a6", "#f59e0b", "#8b5cf6", "#e85d75"];
const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value);

const emptyForm: CustomerInput = { id: "", nombre: "", gastoAcumulado: 0, visitas6Meses: 0, antiguedadMeses: 0 };

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6",
    chart: "M3 3v18h18 M8 15l4-4 4 3 5-7",
    target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 12h.01",
    light: "M9 18h6 M10 22h4 M8 14c-1.3-1-2-2.5-2-4a6 6 0 1 1 12 0c0 1.5-.7 3-2 4-.7.6-1 1.2-1 2h-6c0-.8-.3-1.4-1-2z",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3",
    plus: "M12 5v14 M5 12h14",
    edit: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z",
    trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5",
    play: "M7 4l13 8-13 8z",
    check: "M5 12l4 4L19 6",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    close: "M18 6L6 18 M6 6l12 12",
    sort: "M4 6h16 M7 12h10 M10 18h4"
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid} /></svg>;
}

function App() {
  const [customers, setCustomers] = useState<Customer[]>(() => loadCustomers());
  const [page, setPage] = useState<Page>("dashboard");
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"gastoAcumulado" | "visitas6Meses">("gastoAcumulado");
  const [k, setK] = useState(3);
  const [summary, setSummary] = useState<SegmentationSummary | null>(() => {
    try {
      const value = localStorage.getItem("nova_segmentation_v1");
      return value ? JSON.parse(value) as SegmentationSummary : null;
    } catch { return null; }
  });
  const [lastRunCount, setLastRunCount] = useState<number>(() => Number(localStorage.getItem("nova_audit_count") || 0));
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => { saveCustomers(customers); }, [customers]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const averageSpend = customers.length ? customers.reduce((sum, c) => sum + c.gastoAcumulado, 0) / customers.length : 0;
  const averageVisits = customers.length ? customers.reduce((sum, c) => sum + c.visitas6Meses, 0) / customers.length : 0;
  const assignedCount = customers.filter((c) => c.segmento !== undefined).length;

  const visibleCustomers = useMemo(() => customers
    .filter((customer) => `${customer.id} ${customer.nombre}`.toLowerCase().includes(search.toLowerCase()))
    .filter((customer) => segmentFilter === "all" || String(customer.segmento) === segmentFilter)
    .sort((a, b) => b[sortBy] - a[sortBy]), [customers, search, segmentFilter, sortBy]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, id: `C${String(Math.max(0, ...customers.map(c => Number(c.id.replace(/\D/g, "")) || 0)) + 1).padStart(3, "0")}` });
    setError("");
    setFormOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({ id: customer.id, nombre: customer.nombre, gastoAcumulado: customer.gastoAcumulado, visitas6Meses: customer.visitas6Meses, antiguedadMeses: customer.antiguedadMeses });
    setError("");
    setFormOpen(true);
  };

  const submitCustomer = (event: FormEvent) => {
    event.preventDefault();
    const normalized: CustomerInput = { ...form, id: form.id.trim().toUpperCase(), nombre: form.nombre.trim() };
    const validation = validateCustomer(normalized, customers, editingId || undefined);
    if (validation) { setError(validation); return; }
    if (editingId) {
      setCustomers(previous => previous.map(c => c.id === editingId ? { ...normalized } : c));
      setNotice("Cliente actualizado correctamente.");
    } else {
      setCustomers(previous => [...previous, normalized]);
      setNotice("Cliente registrado correctamente.");
    }
    setSummary(null);
    setFormOpen(false);
    setError("");
  };

  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${customer.nombre} (${customer.id})?`)) return;
    setCustomers(previous => previous.filter(c => c.id !== customer.id));
    setSummary(null);
    setNotice("Cliente eliminado.");
  };

  const executeSegmentation = async () => {
    setError("");
    setBusy(true);
    await new Promise(resolve => window.setTimeout(resolve, 150));
    try {
      const result = await runKMeans(customers, k);
      setCustomers(result.customers);
      setSummary(result.summary);
      setLastRunCount(result.summary.cantidadProcesada);
      localStorage.setItem("nova_segmentation_v1", JSON.stringify(result.summary));
      localStorage.setItem("nova_audit_count", String(result.summary.cantidadProcesada));
      setNotice(`Segmentación ejecutada: ${result.summary.cantidadProcesada} clientes procesados.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible ejecutar la segmentación.");
    } finally { setBusy(false); }
  };

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "customers", label: "Clientes", icon: "users" },
    { id: "segmentation", label: "Segmentación", icon: "target" },
    { id: "recommendations", label: "Recomendaciones", icon: "light" }
  ];
  const pageTitles: Record<Page, { title: string; subtitle: string }> = {
    dashboard: { title: "Panel principal", subtitle: "Resumen general del comportamiento de tus clientes." },
    customers: { title: "Gestión de clientes", subtitle: "Administra, consulta y actualiza la información comercial." },
    segmentation: { title: "Segmentación de clientes", subtitle: "Descubre grupos de clientes con hábitos de compra similares." },
    recommendations: { title: "Recomendaciones comerciales", subtitle: "Convierte los resultados del análisis en acciones orientativas." }
  };

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-overlay" aria-label="Cerrar navegación" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div><strong>nova<span>.</span></strong><small>CLIENT INTELLIGENCE</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><Icon name="close" /></button>
        </div>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="workspace"><div className="workspace-avatar">CN</div><div><strong>Comercial Nova</strong><small>Área comercial</small></div><span className="online-dot" /></div>
        <div className="nav-label">MENÚ PRINCIPAL</div>
        <nav className="nav-list">
          {navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setMobileNav(false); }}>
            <Icon name={item.icon} /><span>{item.label}</span>{item.id === "customers" && <span className="nav-count">{customers.length}</span>}
          </button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note"><span className="local-note-icon"><Icon name="check" /></span><div><strong>API de segmentación activa</strong><small>K-Means procesado en Python</small></div></div>
          <div className="profile"><div className="profile-avatar">AD</div><div><strong>Administrador</strong><small>Gestión comercial</small></div><span className="profile-dots">•••</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Icon name="menu" /></button>
          <div className="breadcrumb">Comercial Nova <span>/</span> <strong>{pageTitles[page].title}</strong></div>
          <div className="topbar-right"><span className="status-pill"><span /> Sistema operativo</span><div className="top-avatar">AD</div></div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">INTELIGENCIA COMERCIAL <span>•</span> 2026</div><h1>{pageTitles[page].title}</h1><p>{pageTitles[page].subtitle}</p></div>
            {page === "customers" && <button className="button button-primary" onClick={openCreate}><Icon name="plus" /> Nuevo cliente</button>}
            {page === "segmentation" && <button className="button button-primary" onClick={executeSegmentation} disabled={busy}><Icon name="play" /> {busy ? "Procesando..." : "Ejecutar K-Means"}</button>}
          </div>

          {notice && <div className="toast"><Icon name="check" />{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso"><Icon name="close" /></button></div>}
          {error && !formOpen && <div className="alert alert-error"><strong>Atención:</strong> {error}<button onClick={() => setError("")} aria-label="Cerrar error"><Icon name="close" /></button></div>}

          {page === "dashboard" && <Dashboard customers={customers} summary={summary} averageSpend={averageSpend} averageVisits={averageVisits} onGoCustomers={() => setPage("customers")} onGoSegmentation={() => setPage("segmentation")} />}
          {page === "customers" && <section className="panel">
            <div className="panel-header"><div><h2>Directorio de clientes</h2><p>{customers.length} registros en tu espacio de trabajo</p></div><div className="table-tools">
              <label className="search-box"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o código..." /></label>
              <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} aria-label="Filtrar por segmento"><option value="all">Todos los segmentos</option>{Array.from({ length: summary?.k || 0 }, (_, i) => <option key={i} value={String(i)}>Segmento {i + 1}</option>)}</select>
            </div></div>
            <CustomerTable customers={visibleCustomers} onEdit={openEdit} onDelete={deleteCustomer} />
            <div className="table-footer"><span>Mostrando <strong>{visibleCustomers.length}</strong> de <strong>{customers.length}</strong> clientes</span><span><i className="footer-dot" /> Clientes guardados en este navegador</span></div>
          </section>}
          {page === "segmentation" && <SegmentationPage customers={customers} k={k} setK={setK} summary={summary} busy={busy} onRun={executeSegmentation} lastRunCount={lastRunCount} />}
          {page === "recommendations" && <Recommendations customers={customers} summary={summary} onGoSegmentation={() => setPage("segmentation")} />}
        </div>
        <footer className="footer"><span>© 2026 Comercial Nova</span><span><span className="footer-dot" /> React + TypeScript · API Python · scikit-learn</span></footer>
      </main>

      {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}>
        <form className="customer-modal" onSubmit={submitCustomer}>
          <div className="modal-heading"><div><div className="eyebrow">{editingId ? "ACTUALIZAR REGISTRO" : "NUEVO REGISTRO"}</div><h2>{editingId ? "Editar cliente" : "Registrar cliente"}</h2><p>Completa los datos de comportamiento de compra.</p></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Cerrar"><Icon name="close" /></button></div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <label>Código del cliente<input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} required maxLength={20} disabled={!!editingId} placeholder="Ej. C013" /></label>
            <label>Nombre completo<input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required maxLength={100} placeholder="Nombre del cliente" /></label>
            <label>Gasto acumulado (S/)<input type="number" min="0" step="0.01" value={form.gastoAcumulado} onChange={e => setForm({ ...form, gastoAcumulado: Number(e.target.value) })} required /></label>
            <label>Visitas en 6 meses<input type="number" min="0" step="1" value={form.visitas6Meses} onChange={e => setForm({ ...form, visitas6Meses: Number(e.target.value) })} required /></label>
            <label>Antigüedad (meses)<input type="number" min="0" step="1" value={form.antiguedadMeses} onChange={e => setForm({ ...form, antiguedadMeses: Number(e.target.value) })} required /></label>
          </div>
          <div className="modal-footer"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="button button-primary"><Icon name="check" /> {editingId ? "Guardar cambios" : "Registrar cliente"}</button></div>
        </form>
      </div>}
    </div>
  );
}

function Dashboard({ customers, summary, averageSpend, averageVisits, onGoCustomers, onGoSegmentation }: {
  customers: Customer[]; summary: SegmentationSummary | null; averageSpend: number; averageVisits: number; onGoCustomers: () => void; onGoSegmentation: () => void;
}) {
  const groupData = summary?.grupos.map(g => ({ name: `Segmento ${g.id + 1}`, clientes: g.cantidad, gasto: Math.round(g.gastoPromedio) })) || [];
  const pieData = groupData.filter(g => g.clientes > 0);
  const recent = [...customers].sort((a, b) => b.gastoAcumulado - a.gastoAcumulado).slice(0, 5);
  return <>
    <div className="welcome-banner"><div className="welcome-copy"><div className="welcome-label"><span /> VISTA GENERAL</div><h2>Conoce mejor a tus clientes.</h2><p>Analiza patrones de compra y encuentra oportunidades para tu estrategia comercial.</p><button className="button button-light" onClick={onGoSegmentation}>Explorar segmentación <span>→</span></button></div><div className="welcome-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-orb"><Icon name="chart" /></div><div className="art-float float-one">↗ <strong>+12.8%</strong><small>Engagement</small></div><div className="art-float float-two"><span className="mini-bars"><i /><i /><i /><i /><i /></span><small>Datos de clientes</small></div></div></div>
    <div className="section-title-row"><div><h2>Indicadores principales</h2><p>Resumen actualizado con tus registros</p></div><span className="updated-label"><span /> Actualizado ahora</span></div>
    <div className="kpi-grid">
      <Kpi icon="users" label="Total de clientes" value={String(customers.length)} note="Registros disponibles" color="blue" />
      <Kpi icon="chart" label="Gasto promedio" value={money(averageSpend)} note="Por cliente registrado" color="teal" />
      <Kpi icon="target" label="Visitas promedio" value={number(averageVisits)} note="Últimos seis meses" color="amber" />
      <Kpi icon="grid" label="Segmentos detectados" value={summary ? String(summary.k) : "—"} note={summary ? `${summary.cantidadProcesada} clientes analizados` : "Ejecuta K-Means para calcular"} color="violet" />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-header"><div><h2>Distribución de segmentos</h2><p>{summary ? "Clientes agrupados por K-Means" : "Aún no hay una segmentación ejecutada"}</p></div><span className="panel-icon"><Icon name="chart" /></span></div>
        {pieData.length ? <div className="pie-wrap"><div className="pie-chart"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} dataKey="clientes" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={4}>{pieData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="pie-center"><strong>{summary?.cantidadProcesada}</strong><small>clientes</small></div></div><div className="legend">{pieData.map((entry, i) => <div className="legend-row" key={entry.name}><span style={{ background: COLORS[i % COLORS.length] }} /><span>{entry.name}</span><strong>{entry.clientes}</strong></div>)}</div></div> : <EmptyState icon="chart" title="Sin datos de segmentación" description="Ejecuta K-Means para visualizar cómo se distribuyen los clientes." action="Ir a segmentación" onClick={onGoSegmentation} />}
      </section>
      <section className="panel"><div className="panel-header"><div><h2>Clientes destacados</h2><p>Mayor gasto acumulado</p></div><button className="text-button" onClick={onGoCustomers}>Ver todos →</button></div>
        <div className="top-customers">{recent.map((customer, i) => <div className="top-customer" key={customer.id}><div className={`customer-avatar avatar-${i % 5}`}>{customer.nombre.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}</div><div className="customer-identity"><strong>{customer.nombre}</strong><small>{customer.id} · {customer.visitas6Meses} visitas</small></div><strong className="customer-spend">{money(customer.gastoAcumulado)}</strong></div>)}</div>
      </section>
    </div>
    <section className="panel bottom-chart"><div className="panel-header"><div><h2>Gasto promedio por segmento</h2><p>Comparación en soles según la última ejecución</p></div></div>
      {groupData.length ? <div className="bar-chart"><ResponsiveContainer width="100%" height={240}><BarChart data={groupData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef5" /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(v) => money(Number(v))} /><Bar dataKey="gasto" name="Gasto promedio" fill="#2463eb" radius={[6, 6, 0, 0]} barSize={44} /></BarChart></ResponsiveContainer></div> : <EmptyState icon="chart" title="Gráfico pendiente" description="Los promedios aparecerán después de ejecutar una segmentación." action="Ejecutar K-Means" onClick={onGoSegmentation} />}
    </section>
  </>;
}

function Kpi({ icon, label, value, note, color }: { icon: string; label: string; value: string; note: string; color: string }) {
  return <div className="kpi-card"><div className={`kpi-icon ${color}`}><Icon name={icon} /></div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-note">{note}</div><div className={`kpi-accent ${color}`} /></div>;
}

function CustomerTable({ customers, onEdit, onDelete }: { customers: Customer[]; onEdit: (c: Customer) => void; onDelete: (c: Customer) => void }) {
  if (!customers.length) return <EmptyState icon="search" title="No se encontraron clientes" description="Prueba otra búsqueda o registra un nuevo cliente." />;
  return <div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>GASTO ACUMULADO</th><th>VISITAS (6 MESES)</th><th>ANTIGÜEDAD</th><th>SEGMENTO</th><th className="actions-heading">ACCIONES</th></tr></thead><tbody>
    {customers.map((customer, i) => <tr key={customer.id}><td><div className="table-person"><div className={`customer-avatar avatar-${i % 5}`}>{customer.nombre.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}</div><div><strong>{customer.nombre}</strong><small>{customer.id}</small></div></div></td><td className="table-money">{money(customer.gastoAcumulado)}</td><td>{customer.visitas6Meses}</td><td>{customer.antiguedadMeses} meses</td><td>{customer.segmento !== undefined ? <span className="segment-badge" style={{ "--segment-color": COLORS[customer.segmento % COLORS.length] } as React.CSSProperties}><i /> Segmento {customer.segmento + 1}</span> : <span className="muted-badge">Sin asignar</span>}</td><td><div className="row-actions"><button className="action-button" title="Editar cliente" onClick={() => onEdit(customer)}><Icon name="edit" /></button><button className="action-button danger" title="Eliminar cliente" onClick={() => onDelete(customer)}><Icon name="trash" /></button></div></td></tr>)}
  </tbody></table></div>;
}

function SegmentationPage({ customers, k, setK, summary, busy, onRun, lastRunCount }: {
  customers: Customer[]; k: number; setK: (k: number) => void; summary: SegmentationSummary | null; busy: boolean; onRun: () => void; lastRunCount: number;
}) {
  return <>
    <div className="segmentation-intro"><div className="segmentation-symbol"><Icon name="target" /></div><div><h2>Encuentra patrones de comportamiento</h2><p>K-Means agrupa clientes según similitudes en gasto, frecuencia de visitas y antigüedad. El proceso es automático y no necesita etiquetas previas.</p></div></div>
    <div className="segmentation-layout">
      <section className="panel config-panel"><div className="panel-header"><div><h2>Configuración del análisis</h2><p>Define cuántos grupos quieres encontrar.</p></div><span className="step-number">01</span></div>
        <label className="field-label" htmlFor="k-select">Número de segmentos (K)</label><select id="k-select" className="k-select" value={k} onChange={e => setK(Number(e.target.value))}>{[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} segmentos</option>)}</select>
        <div className="k-options">{[2, 3, 4, 5].map(n => <button key={n} className={`k-option ${k === n ? "selected" : ""}`} onClick={() => setK(n)}><strong>{n}</strong><small>grupos</small></button>)}</div>
        <div className="variables-box"><strong>Variables incluidas</strong><div><span>01</span> Gasto acumulado (S/)</div><div><span>02</span> Visitas en los últimos 6 meses</div><div><span>03</span> Antigüedad como cliente (meses)</div></div>
        <div className="data-count"><div><Icon name="users" /><span>Clientes disponibles</span></div><strong>{customers.length}</strong><small>Se requieren al menos {k} clientes válidos.</small></div>
        <button className="button button-primary run-button" onClick={onRun} disabled={busy || customers.length < k}><Icon name="play" />{busy ? "Calculando grupos..." : "Ejecutar segmentación"}</button>
        <p className="privacy-note"><Icon name="check" /> El análisis se ejecuta localmente en tu navegador.</p>
      </section>
      <section className="panel results-panel"><div className="panel-header"><div><h2>Resultado de segmentación</h2><p>Resumen de la última ejecución</p></div><span className="panel-icon"><Icon name="chart" /></span></div>
        {summary ? <><div className="run-summary"><div><small>Última ejecución</small><strong>{new Date(summary.fechaEjecucion).toLocaleString("es-PE")}</strong></div><span className="success-pill"><Icon name="check" /> Completado</span></div><div className="result-metrics"><div><small>Clientes procesados</small><strong>{summary.cantidadProcesada}</strong></div><div><small>Segmentos</small><strong>{summary.k}</strong></div><div><small>Iteraciones</small><strong>{summary.iteraciones}</strong></div></div><div className="group-list">{summary.grupos.map(group => <div className="group-card" key={group.id}><div className="group-color" style={{ background: COLORS[group.id % COLORS.length] }} /><div className="group-main"><strong>Segmento {group.id + 1}</strong><small>{group.cantidad} clientes</small><div className="group-progress"><span style={{ width: `${summary.cantidadProcesada ? group.cantidad / summary.cantidadProcesada * 100 : 0}%`, background: COLORS[group.id % COLORS.length] }} /></div></div><div className="group-average"><small>Gasto promedio</small><strong>{money(group.gastoPromedio)}</strong></div></div>)}</div></> : <EmptyState icon="target" title="Todavía no hay resultados" description="Selecciona K y ejecuta el análisis para calcular los segmentos." />}
      </section>
    </div>
    {summary && <section className="panel segment-detail"><div className="panel-header"><div><h2>Perfil de cada segmento</h2><p>Promedios calculados con los clientes asignados.</p></div></div><div className="table-scroll"><table><thead><tr><th>SEGMENTO</th><th>CLIENTES</th><th>GASTO PROMEDIO</th><th>VISITAS PROMEDIO</th><th>ANTIGÜEDAD PROMEDIO</th></tr></thead><tbody>{summary.grupos.map(g => <tr key={g.id}><td><span className="segment-badge" style={{ "--segment-color": COLORS[g.id % COLORS.length] } as React.CSSProperties}><i /> Segmento {g.id + 1}</span></td><td>{g.cantidad}</td><td className="table-money">{money(g.gastoPromedio)}</td><td>{number(g.visitasPromedio)}</td><td>{number(g.antiguedadPromedio)} meses</td></tr>)}</tbody></table></div></section>}
    <div className="audit-strip"><div className="audit-icon"><Icon name="clock" /></div><div><strong>Auditoría básica</strong><p>Última ejecución: {summary ? new Date(summary.fechaEjecucion).toLocaleString("es-PE") : "Sin ejecuciones registradas"}</p></div><div className="audit-count"><strong>{summary?.cantidadProcesada ?? lastRunCount}</strong><small>registros procesados</small></div></div>
  </>;
}

function Recommendations({ customers, summary, onGoSegmentation }: { customers: Customer[]; summary: SegmentationSummary | null; onGoSegmentation: () => void }) {
  if (!summary) return <section className="panel"><EmptyState icon="light" title="Primero necesitas segmentar a tus clientes" description="Ejecuta K-Means para generar perfiles y recomendaciones basados en promedios reales." action="Ir a segmentación" onClick={onGoSegmentation} /></section>;
  const maxSpend = Math.max(...summary.grupos.map(g => g.gastoPromedio), 1);
  const recommendations = summary.grupos.map(group => {
    const spendLevel = group.gastoPromedio / maxSpend;
    const frequent = group.visitasPromedio >= summary.grupos.reduce((s, g) => s + g.visitasPromedio, 0) / summary.grupos.length;
    let title = "Fortalecer la relación";
    let description = "Prueba comunicaciones útiles y promociones moderadas para incentivar una próxima compra.";
    let action = "Enviar campaña de fidelización";
    if (spendLevel >= 0.7 && frequent) {
      title = "Fidelización preferente";
      description = "El grupo combina gasto relativamente alto y visitas frecuentes. Prioriza beneficios por lealtad y acceso anticipado a novedades.";
      action = "Crear programa de beneficios";
    } else if (spendLevel >= 0.65) {
      title = "Aumentar la recurrencia";
      description = "El gasto promedio es alto frente a otros grupos. Prueba recordatorios y ofertas complementarias relevantes.";
      action = "Proponer productos complementarios";
    } else if (frequent) {
      title = "Impulsar el valor de compra";
      description = "El grupo visita con frecuencia. Evalúa paquetes de productos o incentivos por compra combinada.";
      action = "Diseñar paquetes promocionales";
    } else if (group.antiguedadPromedio < 8) {
      title = "Acompañar a clientes nuevos";
      description = "La antigüedad media es baja. Facilita el descubrimiento del catálogo y comunica cómo aprovechar los productos.";
      action = "Preparar bienvenida comercial";
    }
    return { ...group, title, description, action };
  });
  return <><div className="recommendation-banner"><div className="recommendation-banner-icon"><Icon name="light" /></div><div><h2>Ideas para activar cada segmento</h2><p>Las propuestas se generan a partir de promedios observados. Son orientativas y no representan una verdad absoluta sobre cada persona.</p></div></div><div className="recommendation-grid">{recommendations.map((r, i) => <article className="recommendation-card" key={r.id}><div className="recommendation-top"><span className="recommendation-number" style={{ color: COLORS[i % COLORS.length], background: `${COLORS[i % COLORS.length]}14` }}>0{i + 1}</span><span className="segment-badge" style={{ "--segment-color": COLORS[i % COLORS.length] } as React.CSSProperties}><i /> Segmento {r.id + 1}</span></div><h2>{r.title}</h2><p>{r.description}</p><div className="recommendation-stats"><div><small>Clientes</small><strong>{r.cantidad}</strong></div><div><small>Gasto promedio</small><strong>{money(r.gastoPromedio)}</strong></div><div><small>Visitas promedio</small><strong>{number(r.visitasPromedio)}</strong></div></div><div className="recommendation-action"><span><Icon name="light" /></span><div><small>Acción sugerida</small><strong>{r.action}</strong></div></div></article>)}</div><div className="disclaimer"><strong>Nota de interpretación</strong><p>Los segmentos son grupos estadísticos creados por K-Means. Los números de segmento son etiquetas técnicas y pueden cambiar cuando se ejecuta nuevamente el algoritmo con otros datos o con otro valor de K. Actualmente se analizan {customers.length} clientes registrados.</p></div></>;
}

function EmptyState({ icon, title, description, action, onClick }: { icon: string; title: string; description: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} /></div><h3>{title}</h3><p>{description}</p>{action && onClick && <button className="button button-secondary" onClick={onClick}>{action} →</button>}</div>;
}

export default App;
