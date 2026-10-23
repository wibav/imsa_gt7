"use client";
import { useState, useEffect } from "react";
import PageHeader from "../components/PageHeader";
import { useOrganization } from "../context/OrganizationContext";
import ReglamentoPdfButton from "../components/ReglamentoPdfButton";
import reglamentoGeneral from "../data/reglamento-general.json";

// ============================
// DATOS DEL REGLAMENTO (respaldo)
// ============================
// Cada organización tiene su reglamento en Firestore
// (organizations/{orgId}.reglamento). Este JSON es el respaldo que se ve
// mientras carga o si la organización no tiene reglamento propio. Se genera
// con scripts/reglamento/reglamento-general-v2.py y es el mismo texto que se
// publica en GT7 ESP.
const DEFAULT_REGLAMENTO = reglamentoGeneral;
const DEFAULT_SECTIONS = fromFirestoreSafe(reglamentoGeneral.sections);

// ============================
// SUB-COMPONENTS
// ============================

function SectionNav({ sections, activeSection, onSelect }) {
    return (
        <nav className="hidden lg:block sticky top-24 w-64 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Contenido</p>
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id
                            ? "bg-orange-600/20 text-orange-400 font-semibold"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {s.icon} {sections.indexOf(s) + 1}. {s.title}
                    </button>
                ))}
            </div>
        </nav>
    );
}

function SectionCard({ section, numero }) {
    return (
        <div id={section.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden scroll-mt-28">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-white/10 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="text-2xl">{section.icon}</span>
                    <span><span className="text-orange-300 mr-1">{numero}.</span>{section.title}</span>
                </h2>
            </div>

            {/* Content blocks */}
            <div className="px-6 py-5 space-y-6">
                {section.content.map((block, bIdx) => (
                    <div key={bIdx}>
                        <h3 id={`${section.id}-${bIdx + 1}`} className="text-orange-400 font-semibold text-sm uppercase tracking-wider mb-3 scroll-mt-28">
                            <span className="text-orange-300/80 mr-1.5 normal-case tracking-normal">{numero}.{bIdx + 1}</span>{block.subtitle}
                        </h3>

                        {block.type === "table" ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            {block.headers.map((h, hIdx) => (
                                                <th key={hIdx} className="text-left py-2 px-3 text-gray-500 font-semibold text-xs uppercase">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx} className={`py-2.5 px-3 ${cIdx === 0 ? "text-white font-medium" : "text-gray-300"}`}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <ul className="space-y-2.5">
                                {block.items.map((item, iIdx) => (
                                    <li key={iIdx} className="flex gap-3 text-gray-300 text-sm leading-relaxed">
                                        {/* Misma numeración que citan las resoluciones (sección.bloque.punto) */}
                                        <span className="text-orange-400/90 font-mono text-xs mt-0.5 flex-shrink-0 w-12">{numero}.{bIdx + 1}.{iIdx + 1}</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {(block.figuras || []).map(fig => (
                            <figure key={fig.src} className="mt-4">
                                <a href={fig.src} target="_blank" rel="noopener noreferrer" title="Ver a tamaño completo">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={fig.src} alt={fig.alt} loading="lazy" className="w-full max-w-2xl rounded-xl border border-white/10" />
                                </a>
                                <figcaption className="text-xs text-gray-500 mt-1.5">Figura · {fig.alt}</figcaption>
                            </figure>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================
// MAIN PAGE
// ============================

// Firestore no admite arrays anidados dentro de arrays: las filas de tabla
// (`rows`) se guardan como { cells: [...] } (ver migrate-reglamento-to-org.js).
// Se revierte aquí a array-of-arrays para que el render no tenga que saber
// de esta limitación de Firestore.
function fromFirestoreSafe(sections) {
    return sections.map(section => ({
        ...section,
        content: section.content.map(block => {
            if (!Array.isArray(block.rows)) return block;
            return { ...block, rows: block.rows.map(r => (Array.isArray(r) ? r : r.cells)) };
        }),
    }));
}

export default function ReglamentoPage() {
    const { org } = useOrganization();
    const [sections, setSections] = useState(DEFAULT_SECTIONS);
    const [meta, setMeta] = useState({ version: DEFAULT_REGLAMENTO.version, fecha: DEFAULT_REGLAMENTO.fecha });
    const [activeSection, setActiveSection] = useState(DEFAULT_SECTIONS[0].id);

    // Usa el reglamento de la organización ya resuelta por OrganizationContext
    // (Fase 3). Si la org no tiene reglamento propio configurado, se mantiene
    // el fallback DEFAULT_SECTIONS ya mostrado.
    useEffect(() => {
        const orgSections = org?.reglamento?.sections;
        if (Array.isArray(orgSections) && orgSections.length > 0) {
            const normalized = fromFirestoreSafe(orgSections);
            setSections(normalized);
            setActiveSection(normalized[0].id);
            setMeta({ version: org.reglamento.version || '', fecha: org.reglamento.fecha || '' });
        }
    }, [org]);

    const fechaLegible = meta.fecha
        ? new Date(`${meta.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

    const handleSelectSection = (id) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <PageHeader
                ancho="max-w-6xl"
                migas={[{ label: 'Reglamento' }]}
                icono="📜"
                titulo="Reglamento General"
                subtitulo="Normas de conducta, sanciones y procedimientos para todos los campeonatos y eventos. Léelo antes de inscribirte para evitar sorpresas."
            >
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                    {fechaLegible && <span>📅 Última actualización: {fechaLegible}</span>}
                    {meta.version && <span>Versión {meta.version}</span>}
                    <span>{sections.length} secciones</span>
                    <ReglamentoPdfButton sections={sections} orgName={org?.name || 'GT7 Championships'} version={meta.version} fecha={fechaLegible} />
                </div>
            </PageHeader>

            {/* Mobile Section Selector */}
            <div className="lg:hidden sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-white/10 px-4 py-3">
                <select
                    value={activeSection}
                    onChange={(e) => handleSelectSection(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:border-orange-500 outline-none"
                >
                    {sections.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-800 text-white">
                            {sections.indexOf(s) + 1}. {s.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">

                {/* Sidebar Nav (desktop) */}
                <SectionNav
                    sections={sections}
                    activeSection={activeSection}
                    onSelect={handleSelectSection}
                />

                {/* Main Content */}
                <div className="flex-1 space-y-6 min-w-0">
                    {sections.map((section) => (
                        <SectionCard key={section.id} section={section} numero={sections.indexOf(section) + 1} />
                    ))}

                    {/* Footer note */}
                    <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-5 text-center">
                        <p className="text-blue-300 text-sm">
                            💡 Este reglamento aplica como base para todos los campeonatos y eventos. Cada campeonato puede tener reglas adicionales o valores de sanción personalizados que se especifican en su configuración individual.
                        </p>
                    </div>

                    {/* Back to dashboard */}
                    <div className="flex justify-center pt-4 pb-8">
                        <button
                            onClick={() => window.location.href = "/"}
                            className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-all"
                        >
                            ← Volver al Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
