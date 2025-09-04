"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminNavigation from "../components/AdminNavigation";
import Image from "next/image";

// Listas de opciones
const YES_NO = ["SI", "NO"];
const DAMAGE_OPTIONS = ["No", "Leves", "Graves"];
const TYRE_OPTIONS = [
    // Regular
    "RD", "RM", "RB",
    // Sport
    "DD", "DM", "DB",
    // Racing
    "CD", "CM", "CB",
    // Wet
    "CI", "CLI",
    // Otros
    "TRR", "NVE"
];

// Pistas comunes de GT7 (principales + ficticias)
const GT7_TRACKS = [
    "Alsace - Village",
    "Autopolis - International",
    "Autopolis - Shortcut",
    "Autódromo de Interlagos",
    "Autodrome Lago Maggiore - GP",
    "Autodrome Lago Maggiore - East",
    "Autodrome Lago Maggiore - West",
    "Barcelona-Catalunya - GP",
    "Barcelona-Catalunya - No Chicane",
    "Bathurst (Mount Panorama)",
    "Blue Moon Bay Speedway",
    "Blue Moon Bay - Infield A",
    "Blue Moon Bay - Infield B",
    "Brands Hatch - GP",
    "Brands Hatch - Indy",
    "Broad Bean Raceway",
    "Circuit de la Sarthe (Le Mans)",
    "Circuit de Spa-Francorchamps",
    "Circuit de Sainte-Croix - A",
    "Circuit de Sainte-Croix - B",
    "Circuit de Sainte-Croix - C",
    "Colorado Springs - Lake",
    "Daytona - Tri-Oval",
    "Daytona - Road Course",
    "Deep Forest Raceway",
    "Dragon Trail - Seaside",
    "Dragon Trail - Gardens",
    "Fishermans Ranch",
    "Goodwood Motor Circuit",
    "Grand Valley - Highway 1",
    "High Speed Ring",
    "Kyoto Driving Park - Miyabi",
    "Kyoto Driving Park - Yamagiwa",
    "Laguna Seca",
    "Lake Louise - Long Track",
    "Lake Louise - Short Track",
    "Lake Louise - Tri-Oval",
    "Michelin Raceway Road Atlanta",
    "Monza",
    "Monza - No Chicane",
    "Northern Isle Speedway",
    "Nürburgring - Nordschleife",
    "Nürburgring - 24h",
    "Nürburgring - GP",
    "Red Bull Ring",
    "Sardegna - Road Track A",
    "Sardegna - Road Track B",
    "Sardegna - Road Track C",
    "Sardegna - Windmills",
    "Special Stage Route X",
    "Suzuka Circuit",
    "Tokyo Expressway - Central Clockwise",
    "Tokyo Expressway - Central Counterclockwise",
    "Tokyo Expressway - East Clockwise",
    "Tokyo Expressway - East Counterclockwise",
    "Tokyo Expressway - South Clockwise",
    "Tokyo Expressway - South Counterclockwise",
    "Trial Mountain Circuit",
    "Tsukuba Circuit",
    "Watkins Glen",
    "Willow Springs - Big Willow",
    "Willow Springs - Streets of Willow",
    "Willow Springs - Horse Thief Mile"
];

export default function EventsAdminPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const fetched = await FirebaseService.getEvents();
            // Orden sencillo por fecha asc
            fetched.sort((a, b) => new Date(a.date) - new Date(b.date));
            setEvents(fetched);
        } catch (error) {
            console.error("Error fetching events:", error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await FirebaseService.saveEvents(events);
            alert("Eventos guardados correctamente");
        } catch (error) {
            console.error("Error saving events:", error);
            alert("Error al guardar eventos: " + error.message);
        }
    };

    const updateEvent = (index, field, value) => {
        const updated = [...events];
        updated[index][field] = value;
        setEvents(updated);
    };

    const updateRule = (index, ruleKey, value) => {
        const updated = [...events];
        updated[index].rules = { ...(updated[index].rules || {}), [ruleKey]: value };
        setEvents(updated);
    };

    const handleBannerFile = async (index, file) => {
        if (!file) return;
        const toDataUrl = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        try {
            const dataUrl = await toDataUrl(file);
            updateEvent(index, 'banner', String(dataUrl));
        } catch (e) {
            console.error('Error leyendo archivo:', e);
            alert('No se pudo leer la imagen seleccionada');
        }
    };

    const addParticipant = (index) => {
        const updated = [...events];
        const list = updated[index].participants || [];
        if (list.length >= (updated[index].maxParticipants || 16)) {
            alert("Se alcanzó el máximo de participantes");
            return;
        }
        list.push({ id: crypto.randomUUID(), name: "" });
        updated[index].participants = list;
        setEvents(updated);
    };

    const updateParticipant = (index, pIndex, field, value) => {
        const updated = [...events];
        updated[index].participants[pIndex][field] = value;
        setEvents(updated);
    };

    const removeParticipant = (index, pIndex) => {
        const updated = [...events];
        updated[index].participants.splice(pIndex, 1);
        setEvents(updated);
    };

    const addNewEvent = () => {
        const nextId = (events.length ? Math.max(...events.map(e => parseInt(e.id, 10) || 0)) + 1 : 1);
        const newEvent = {
            id: nextId,
            title: "",
            description: "",
            banner: "", // url
            date: new Date().toISOString().split("T")[0],
            hour: "22:30",
            track: "",
            rules: {
                duration: "2h",
                bop: "SI",
                adjustments: "NO",
                engineSwap: "NO",
                damage: "Graves",
                penalties: "SI",
                // Nuevas reglas
                tyreWear: 5, // x5
                fuelWear: 0, // x0
                fuelRefillRate: 10, // L/s (solo aplicará si fuelWear > 0)
                mandatoryTyre: "CD"
            },
            maxParticipants: 16,
            participants: []
        };
        setEvents([...events, newEvent]);
    };

    const removeEvent = async (index) => {
        const ev = events[index];
        if (!ev) return;
        if (confirm("¿Estás seguro de eliminar este evento?")) {
            try {
                await FirebaseService.deleteEvent(ev.id);
                setEvents(prev => prev.filter((_, i) => i !== index));
            } catch (error) {
                console.error('Error eliminando evento:', error);
                alert('No se pudo eliminar el evento en el servidor.');
            }
        }
    };

    if (loading) {
        return (
            <ProtectedRoute requireAdmin={true}>
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
                        <p className="text-white mt-4 text-xl">Cargando eventos...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requireAdmin={true}>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-800">
                <AdminNavigation currentPage="events" />

                <div className="max-w-7xl mx-auto p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-4xl font-bold text-white flex items-center gap-3">🎉 Administrar Eventos</h2>
                            <p className="text-green-200 text-lg mt-2">Gestiona eventos especiales y sus participantes</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={handleSave} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2">💾 Guardar</button>
                            <button onClick={addNewEvent} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2">➕ Nuevo Evento</button>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {events.map((ev, index) => (
                            <div key={ev.id} className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl">
                                {/* Banner */}
                                <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900">
                                    {ev.banner ? (
                                        <Image src={ev.banner} alt={`Banner ${ev.title}`} width={800} height={200} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-5xl">🏁</div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-sm font-bold">#{ev.id}</div>
                                    <button onClick={() => removeEvent(index)} className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200" title="Eliminar evento">×</button>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">Título</label>
                                        <input type="text" className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60" value={ev.title || ''} onChange={(e) => updateEvent(index, 'title', e.target.value)} placeholder="Título del evento" />
                                    </div>

                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">Descripción</label>
                                        <textarea className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60" rows={3} value={ev.description || ''} onChange={(e) => updateEvent(index, 'description', e.target.value)} placeholder="Descripción del evento"></textarea>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-green-300 font-semibold mb-2 text-sm">Fecha</label>
                                            <input type="date" className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white" value={ev.date || ''} onChange={(e) => updateEvent(index, 'date', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-green-300 font-semibold mb-2 text-sm">Hora</label>
                                            <input type="time" className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white" value={ev.hour || '22:30'} onChange={(e) => updateEvent(index, 'hour', e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">Pista</label>
                                        <select className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white" value={ev.track || ''} onChange={(e) => updateEvent(index, 'track', e.target.value)}>
                                            <option value="">Selecciona una pista</option>
                                            {GT7_TRACKS.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">Banner (URL o archivo)</label>
                                        <div className="space-y-2">
                                            <input type="url" className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60" value={ev.banner || ''} onChange={(e) => updateEvent(index, 'banner', e.target.value)} placeholder="https://.../banner.png" />
                                            <div className="flex items-center gap-2">
                                                <input type="file" accept="image/*" className="text-white text-sm" onChange={(e) => handleBannerFile(index, e.target.files?.[0])} />
                                                {ev.banner ? (
                                                    <button type="button" onClick={() => updateEvent(index, 'banner', '')} className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Quitar</button>
                                                ) : null}
                                            </div>
                                            {ev.banner && (
                                                <div className="text-xs text-gray-300">Origen: {String(ev.banner).startsWith('data:') ? 'archivo local (embebido)' : 'URL'}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reglas */}
                                    <div className="pt-2 border-t border-white/20">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <InputRule label="Duración" value={ev.rules?.duration || ''} onChange={(v) => updateRule(index, 'duration', v)} />
                                            <SelectRule label="BOP" value={ev.rules?.bop || ''} options={YES_NO} onChange={(v) => updateRule(index, 'bop', v)} />
                                            <SelectRule label="Ajustes" value={ev.rules?.adjustments || ''} options={YES_NO} onChange={(v) => updateRule(index, 'adjustments', v)} />
                                            <SelectRule label="Swap de motor" value={ev.rules?.engineSwap || ''} options={YES_NO} onChange={(v) => updateRule(index, 'engineSwap', v)} />
                                            <SelectRule label="Daños" value={ev.rules?.damage || ''} options={DAMAGE_OPTIONS} onChange={(v) => updateRule(index, 'damage', v)} />
                                            <SelectRule label="Penalizaciones" value={ev.rules?.penalties || ''} options={YES_NO} onChange={(v) => updateRule(index, 'penalties', v)} />
                                            <RangeRule label="Desgaste de neumáticos" min={0} max={50} value={Number(ev.rules?.tyreWear ?? 0)} onChange={(v) => updateRule(index, 'tyreWear', v)} suffix={(v) => `x${v}`} />
                                            <RangeRule label="Desgaste de combustible" min={0} max={50} value={Number(ev.rules?.fuelWear ?? 0)} onChange={(v) => updateRule(index, 'fuelWear', v)} suffix={(v) => `x${v}`} />
                                            {Number(ev.rules?.fuelWear ?? 0) > 0 && (
                                                <RangeRule label="Velocidad de recarga de combustible" min={1} max={20} value={Number(ev.rules?.fuelRefillRate ?? 10)} onChange={(v) => updateRule(index, 'fuelRefillRate', v)} suffix={(v) => `${v} L/s`} />
                                            )}
                                            <SelectRule label="Neumático obligatorio" value={ev.rules?.mandatoryTyre || ''} options={TYRE_OPTIONS} onChange={(v) => updateRule(index, 'mandatoryTyre', v)} />
                                        </div>
                                    </div>

                                    {/* Participantes */}
                                    <div className="pt-4 border-t border-white/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-green-300 font-semibold">Participantes ({ev.participants?.length || 0}/{ev.maxParticipants || 16})</div>
                                            <button onClick={() => addParticipant(index)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">➕ Añadir</button>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {(ev.participants || []).map((p, pIndex) => (
                                                <div key={p.id} className="flex gap-2 items-center">
                                                    <input type="text" className="flex-1 bg-white/20 border border-white/40 rounded p-2 text-white text-sm" value={p.name || ''} onChange={(e) => updateParticipant(index, pIndex, 'name', e.target.value)} placeholder={`Piloto #${pIndex + 1}`} />
                                                    <button onClick={() => removeParticipant(index, pIndex)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-2 rounded text-xs">🗑️</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Límite de Participantes */}
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">Máximo de participantes</label>
                                        <input type="number" min={1} max={32} className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white" value={ev.maxParticipants || 16} onChange={(e) => updateEvent(index, 'maxParticipants', parseInt(e.target.value, 10))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 text-center">
                        <button onClick={handleSave} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-4 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-3 mx-auto">
                            <span className="text-2xl">💾</span>
                            Guardar Todos los Eventos
                        </button>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}

function InputRule({ label, value, onChange }) {
    return (
        <div>
            <label className="block text-green-300 font-semibold mb-2 text-sm">{label}</label>
            <input type="text" className="w-full bg-white/20 border border-white/40 rounded-lg p-2 text-white text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function SelectRule({ label, value, options, onChange }) {
    return (
        <div>
            <label className="block text-green-300 font-semibold mb-2 text-sm">{label}</label>
            <select className="w-full bg-white/20 border border-white/40 rounded-lg p-2 text-white text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">Selecciona</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function RangeRule({ label, value, min = 0, max = 50, step = 1, onChange, suffix }) {
    const handleChange = (e) => onChange(Number(e.target.value));
    return (
        <div>
            <label className="block text-green-300 font-semibold mb-2 text-sm">{label}</label>
            <div className="flex items-center gap-3">
                <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange} className="flex-1" />
                <input type="number" min={min} max={max} step={step} value={value} onChange={handleChange} className="w-20 bg-white/20 border border-white/40 rounded p-1 text-white text-sm" />
            </div>
            <div className="text-xs text-gray-300 mt-1">{suffix ? suffix(value) : value}</div>
        </div>
    );
}

function NumberRule({ label, value, min, max, step = 1, onChange, suffix }) {
    const handleChange = (e) => onChange(Number(e.target.value));
    return (
        <div>
            <label className="block text-green-300 font-semibold mb-2 text-sm">{label}</label>
            <input type="number" min={min} max={max} step={step} value={value} onChange={handleChange} className="w-full bg-white/20 border border-white/40 rounded p-2 text-white text-sm" />
            <div className="text-xs text-gray-300 mt-1">{suffix ? suffix(value) : value}</div>
        </div>
    );
}
