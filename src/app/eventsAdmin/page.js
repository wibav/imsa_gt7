"use client";
import { useEffect, useState, useMemo } from "react";
import { FirebaseService } from "../services/firebaseService";
import ProtectedRoute from "../components/ProtectedRoute";
import Image from "next/image";
import {
    GT7_TRACKS, EVENT_STATUSES, EVENT_CATEGORIES, EVENT_FORMATS,
    STREAMING_PLATFORMS, TYRE_OPTIONS, DAMAGE_OPTIONS, WEATHER_TIME_OPTIONS
} from "../utils";

// ============================
// DEFAULTS
// ============================

const DEFAULT_RULES = {
    duration: '', laps: '',
    bop: 'SI', adjustments: 'NO', engineSwap: 'NO',
    damage: 'Graves', penalties: 'SI', shortcutPenalty: 'NO', ghostCar: 'NO',
    tyreWear: 5, fuelWear: 0, fuelRefillRate: 10, mandatoryTyres: []
};

const DEFAULT_STREAMING = { casterName: '', hostName: '', url: '', platform: '' };
const DEFAULT_REGISTRATION = { enabled: false, requiresApproval: false, deadline: '' };
const DEFAULT_WEATHER = { timeOfDay: '', timeMultiplier: 1, weatherSlots: '' };

const createNewEvent = (nextId) => ({
    id: nextId,
    title: '', description: '', banner: '',
    date: new Date().toISOString().split('T')[0],
    hour: '22:30', track: '',
    status: 'upcoming', category: 'competitive', format: 'race',
    rules: { ...DEFAULT_RULES },
    streaming: { ...DEFAULT_STREAMING },
    registration: { ...DEFAULT_REGISTRATION },
    weather: { ...DEFAULT_WEATHER },
    specificCars: false, allowedCars: [],
    prizes: '', maxParticipants: 16,
    participants: [], results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

// ============================
// HELPERS
// ============================

const computeStatus = (event) => {
    if (event.status === 'live') return 'live';
    if (event.status === 'completed') return 'completed';
    if (!event.date) return 'upcoming';
    const eventDate = new Date(event.date + 'T23:59:59');
    return eventDate < new Date() ? 'completed' : 'upcoming';
};

const formatEventDate = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const getCountdown = (dateStr, hour) => {
    if (!dateStr) return null;
    const target = new Date(`${dateStr}T${hour || '00:00'}:00`);
    const diff = target - new Date();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
};

// ============================
// SUB-COMPONENTS
// ============================

function StatusBadge({ status }) {
    const config = EVENT_STATUSES[status] || EVENT_STATUSES.upcoming;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${config.color} text-white`}>
            {config.icon} {config.label}
        </span>
    );
}

function CategoryBadge({ category }) {
    const cat = EVENT_CATEGORIES.find(c => c.value === category);
    if (!cat) return null;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-white/10 text-gray-300">
            {cat.icon} {cat.label}
        </span>
    );
}

function ToggleSwitch({ enabled, onChange, label, description }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
                <span className="text-white font-semibold text-sm">{label}</span>
                {description && <p className="text-gray-400 text-xs mt-0.5">{description}</p>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-orange-500' : 'bg-gray-600'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/20 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="text-white font-semibold text-sm">{title}</span>
                    {badge && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{badge}</span>}
                </div>
                <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {open && (
                <div className="px-4 py-4 space-y-4 bg-white/[0.02]">
                    {children}
                </div>
            )}
        </div>
    );
}

// ============================
// EVENT FORM
// ============================

function EventForm({ event, onSave, onCancel, saving }) {
    const [form, setForm] = useState(() => ({
        ...createNewEvent(1),
        ...event,
        rules: { ...DEFAULT_RULES, ...(event?.rules || {}) },
        streaming: { ...DEFAULT_STREAMING, ...(event?.streaming || {}) },
        registration: { ...DEFAULT_REGISTRATION, ...(event?.registration || {}) },
        weather: { ...DEFAULT_WEATHER, ...(event?.weather || {}) }
    }));
    const [newCar, setNewCar] = useState('');
    const isEditing = Boolean(event?.title);

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const updateRules = (key, value) => setForm(prev => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
    const updateStreaming = (key, value) => setForm(prev => ({ ...prev, streaming: { ...prev.streaming, [key]: value } }));
    const updateRegistration = (key, value) => setForm(prev => ({ ...prev, registration: { ...prev.registration, [key]: value } }));
    const updateWeather = (key, value) => setForm(prev => ({ ...prev, weather: { ...prev.weather, [key]: value } }));

    // Banner upload
    const handleBannerFile = async (file) => {
        if (!file) return;
        try {
            const path = `events/${form.id || 'new'}/banner_${Date.now()}`;
            const url = await FirebaseService.uploadImage(file, path);
            updateField('banner', url);
        } catch {
            // Fallback: data URL
            const reader = new FileReader();
            reader.onload = () => updateField('banner', reader.result);
            reader.readAsDataURL(file);
        }
    };

    // Cars management
    const addCar = () => {
        if (!newCar.trim()) return;
        const cars = [...(form.allowedCars || [])];
        if (!cars.includes(newCar.trim())) {
            cars.push(newCar.trim());
            updateField('allowedCars', cars);
        }
        setNewCar('');
    };
    const removeCar = (idx) => {
        const cars = [...(form.allowedCars || [])];
        cars.splice(idx, 1);
        updateField('allowedCars', cars);
    };

    // Participants
    const addParticipant = () => {
        const list = [...(form.participants || [])];
        if (form.maxParticipants && list.length >= form.maxParticipants) {
            alert(`Máximo ${form.maxParticipants} participantes`);
            return;
        }
        list.push({ id: crypto.randomUUID(), name: '', psnId: '' });
        updateField('participants', list);
    };
    const updateParticipant = (idx, key, value) => {
        const list = [...form.participants];
        list[idx] = { ...list[idx], [key]: value };
        updateField('participants', list);
    };
    const removeParticipant = (idx) => {
        const list = [...form.participants];
        list.splice(idx, 1);
        updateField('participants', list);
    };

    // Results
    const addResult = () => {
        const results = [...(form.results || [])];
        results.push({ driverName: '', position: results.length + 1, psnId: '' });
        updateField('results', results);
    };
    const updateResult = (idx, key, value) => {
        const results = [...(form.results || [])];
        results[idx] = { ...results[idx], [key]: value };
        updateField('results', results);
    };
    const removeResult = (idx) => {
        const results = [...(form.results || [])];
        results.splice(idx, 1);
        results.forEach((r, i) => r.position = i + 1);
        updateField('results', results);
    };

    const handleSubmit = () => {
        if (!form.title?.trim()) { alert('El título es obligatorio'); return; }
        if (!form.date) { alert('La fecha es obligatoria'); return; }
        onSave(form);
    };

    // ---- FORM INPUTS (reusable classes) ----
    const inputCls = "w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white placeholder-white/40 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors";
    const labelCls = "block text-gray-300 font-semibold mb-1 text-sm";

    return (
        <div className="space-y-4">
            {/* Form Header (sticky) */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors text-lg">←</button>
                    <h2 className="text-xl font-bold text-white">
                        {isEditing ? `✏️ Editar: ${form.title || 'Sin título'}` : '➕ Nuevo Evento'}
                    </h2>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                >
                    {saving ? '⏳ Guardando...' : '💾 Guardar Evento'}
                </button>
            </div>

            {/* ========== SECTION 1: BASIC INFO ========== */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 space-y-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">📋 Información General</h3>

                <div>
                    <label className={labelCls}>Título *</label>
                    <input type="text" className={inputCls} value={form.title || ''} onChange={(e) => updateField('title', e.target.value)} placeholder="Nombre del evento" />
                </div>

                <div>
                    <label className={labelCls}>Descripción</label>
                    <textarea className={inputCls} rows={3} value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} placeholder="Descripción del evento..." />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className={labelCls}>Fecha *</label>
                        <input type="date" className={inputCls} value={form.date || ''} onChange={(e) => updateField('date', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelCls}>Hora</label>
                        <input type="time" className={inputCls} value={form.hour || '22:30'} onChange={(e) => updateField('hour', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelCls}>Estado</label>
                        <select className={inputCls} value={form.status || 'upcoming'} onChange={(e) => updateField('status', e.target.value)}>
                            {Object.entries(EVENT_STATUSES).map(([key, val]) => (
                                <option key={key} value={key}>{val.icon} {val.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Máx. participantes</label>
                        <input type="number" min={1} max={64} className={inputCls} value={form.maxParticipants || 16} onChange={(e) => updateField('maxParticipants', parseInt(e.target.value, 10) || 16)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Categoría</label>
                        <select className={inputCls} value={form.category || 'competitive'} onChange={(e) => updateField('category', e.target.value)}>
                            {EVENT_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Formato</label>
                        <select className={inputCls} value={form.format || 'race'} onChange={(e) => updateField('format', e.target.value)}>
                            {EVENT_FORMATS.map(fmt => (
                                <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ========== SECTION 2: TRACK & BANNER ========== */}
            <CollapsibleSection title="Circuito y Banner" icon="🏁" defaultOpen={!isEditing}>
                <div>
                    <label className={labelCls}>Circuito</label>
                    <select className={inputCls} value={form.track || ''} onChange={(e) => updateField('track', e.target.value)}>
                        <option value="">Selecciona un circuito</option>
                        {GT7_TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Vueltas</label>
                        <input type="number" min={1} className={inputCls} value={form.rules?.laps || ''} onChange={(e) => updateRules('laps', e.target.value)} placeholder="Ej: 15" />
                    </div>
                    <div>
                        <label className={labelCls}>Duración</label>
                        <input type="text" className={inputCls} value={form.rules?.duration || ''} onChange={(e) => updateRules('duration', e.target.value)} placeholder="Ej: 2h, 45 min" />
                    </div>
                </div>

                {/* Banner */}
                <div>
                    <label className={labelCls}>Banner del evento</label>
                    {form.banner && (
                        <div className="relative mb-3 rounded-lg overflow-hidden">
                            <Image src={form.banner} alt="Banner preview" width={800} height={200} className="w-full h-40 object-cover rounded-lg" />
                            <button type="button" onClick={() => updateField('banner', '')} className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors">×</button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="url"
                            className={`flex-1 ${inputCls} text-sm`}
                            placeholder="URL de la imagen..."
                            value={form.banner?.startsWith('data:') ? '' : (form.banner || '')}
                            onChange={(e) => updateField('banner', e.target.value)}
                        />
                        <label className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer text-sm font-semibold flex items-center gap-1 transition-colors flex-shrink-0">
                            📁 Archivo
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBannerFile(e.target.files?.[0])} />
                        </label>
                    </div>
                    {form.banner && (
                        <p className="text-xs text-gray-400 mt-1">
                            Origen: {form.banner.startsWith('data:') ? 'archivo local (embebido)' : form.banner.includes('firebase') ? 'Firebase Storage' : 'URL externa'}
                        </p>
                    )}
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 3: RACE RULES ========== */}
            <CollapsibleSection title="Reglas de Carrera" icon="⚙️">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { key: 'bop', label: 'Balance of Performance (BOP)' },
                        { key: 'adjustments', label: 'Ajustes de coche' },
                        { key: 'engineSwap', label: 'Cambio de motor (Swap)' },
                        { key: 'penalties', label: 'Penalizaciones del juego' },
                        { key: 'shortcutPenalty', label: 'Penalización por atajos' },
                        { key: 'ghostCar', label: 'Coche fantasma' }
                    ].map(rule => (
                        <div key={rule.key} className="bg-white/5 rounded-lg p-3">
                            <ToggleSwitch
                                enabled={form.rules?.[rule.key] === 'SI'}
                                onChange={(v) => updateRules(rule.key, v ? 'SI' : 'NO')}
                                label={rule.label}
                            />
                        </div>
                    ))}
                </div>
                <div>
                    <label className={labelCls}>Daños</label>
                    <div className="flex gap-2">
                        {DAMAGE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateRules('damage', opt.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${form.rules?.damage === opt.value ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 4: TYRES & FUEL ========== */}
            <CollapsibleSection title="Neumáticos y Combustible" icon="🔧">
                <div>
                    <label className={labelCls}>
                        Desgaste de neumáticos: <span className="text-orange-400 font-bold">x{form.rules?.tyreWear ?? 0}</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input type="range" min={0} max={50} className="flex-1 accent-orange-500" value={form.rules?.tyreWear ?? 0} onChange={(e) => updateRules('tyreWear', Number(e.target.value))} />
                        <input type="number" min={0} max={50} className="w-16 bg-white/10 border border-white/30 rounded p-1.5 text-white text-sm text-center" value={form.rules?.tyreWear ?? 0} onChange={(e) => updateRules('tyreWear', Number(e.target.value))} />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>
                        Desgaste de combustible: <span className="text-orange-400 font-bold">x{form.rules?.fuelWear ?? 0}</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <input type="range" min={0} max={50} className="flex-1 accent-orange-500" value={form.rules?.fuelWear ?? 0} onChange={(e) => updateRules('fuelWear', Number(e.target.value))} />
                        <input type="number" min={0} max={50} className="w-16 bg-white/10 border border-white/30 rounded p-1.5 text-white text-sm text-center" value={form.rules?.fuelWear ?? 0} onChange={(e) => updateRules('fuelWear', Number(e.target.value))} />
                    </div>
                </div>

                {Number(form.rules?.fuelWear) > 0 && (
                    <div>
                        <label className={labelCls}>
                            Velocidad de recarga: <span className="text-orange-400 font-bold">{form.rules?.fuelRefillRate ?? 10} L/s</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input type="range" min={1} max={20} className="flex-1 accent-orange-500" value={form.rules?.fuelRefillRate ?? 10} onChange={(e) => updateRules('fuelRefillRate', Number(e.target.value))} />
                            <input type="number" min={1} max={20} className="w-16 bg-white/10 border border-white/30 rounded p-1.5 text-white text-sm text-center" value={form.rules?.fuelRefillRate ?? 10} onChange={(e) => updateRules('fuelRefillRate', Number(e.target.value))} />
                        </div>
                    </div>
                )}

                <div>
                    <label className={labelCls}>Neumáticos obligatorios</label>
                    <p className="text-gray-500 text-xs mb-2">Selecciona los compuestos que los pilotos deben usar durante la carrera</p>
                    <div className="flex flex-wrap gap-2">
                        {TYRE_OPTIONS.map(t => {
                            const selected = (form.rules?.mandatoryTyres || []).includes(t.value);
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => {
                                        const current = form.rules?.mandatoryTyres || [];
                                        const updated = selected
                                            ? current.filter(v => v !== t.value)
                                            : [...current, t.value];
                                        updateRules('mandatoryTyres', updated);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${selected
                                            ? 'bg-orange-600 border-orange-500 text-white shadow-md'
                                            : 'bg-white/5 border-white/20 text-gray-400 hover:border-orange-500/50 hover:text-orange-300'
                                        }`}
                                >
                                    {selected && '✓ '}{t.label}
                                </button>
                            );
                        })}
                    </div>
                    {(form.rules?.mandatoryTyres || []).length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-gray-500 text-xs">{(form.rules?.mandatoryTyres || []).length} seleccionado(s)</span>
                            <button type="button" onClick={() => updateRules('mandatoryTyres', [])} className="text-red-400 text-xs hover:text-red-300">Limpiar</button>
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 5: WEATHER ========== */}
            <CollapsibleSection title="Clima" icon="🌦️">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Hora del día</label>
                        <select className={inputCls} value={form.weather?.timeOfDay || ''} onChange={(e) => updateWeather('timeOfDay', e.target.value)}>
                            <option value="">Sin especificar</option>
                            {WEATHER_TIME_OPTIONS.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>
                            Multiplicador de tiempo: <span className="text-orange-400 font-bold">x{form.weather?.timeMultiplier ?? 1}</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input type="range" min={1} max={60} className="flex-1 accent-orange-500" value={form.weather?.timeMultiplier ?? 1} onChange={(e) => updateWeather('timeMultiplier', Number(e.target.value))} />
                            <input type="number" min={1} max={60} className="w-16 bg-white/10 border border-white/30 rounded p-1.5 text-white text-sm text-center" value={form.weather?.timeMultiplier ?? 1} onChange={(e) => updateWeather('timeMultiplier', Number(e.target.value))} />
                        </div>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Slots de clima (presets GT7)</label>
                    <input type="text" className={inputCls} value={form.weather?.weatherSlots || ''} onChange={(e) => updateWeather('weatherSlots', e.target.value)} placeholder="Ej: S18/C05/R07/R03/C04" />
                    <p className="text-xs text-gray-500 mt-1">Formato: S=Seco, C=Nublado, R=Lluvia seguido del número de preset</p>
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 6: ALLOWED CARS ========== */}
            <CollapsibleSection title="Coches Permitidos" icon="🏎️" badge={form.specificCars ? `${form.allowedCars?.length || 0} coches` : null}>
                <ToggleSwitch
                    enabled={form.specificCars}
                    onChange={(v) => updateField('specificCars', v)}
                    label="Restringir coches"
                    description="Activar para especificar qué coches están permitidos"
                />
                {form.specificCars && (
                    <div className="space-y-3 mt-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className={`flex-1 ${inputCls} text-sm`}
                                value={newCar}
                                onChange={(e) => setNewCar(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCar())}
                                placeholder="Nombre del coche (Enter para añadir)..."
                            />
                            <button type="button" onClick={addCar} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0">
                                + Añadir
                            </button>
                        </div>
                        {(form.allowedCars || []).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.allowedCars.map((car, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full text-sm border border-blue-500/30">
                                        🏎️ {car}
                                        <button type="button" onClick={() => removeCar(idx)} className="text-red-400 hover:text-red-300 ml-0.5 font-bold">×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CollapsibleSection>

            {/* ========== SECTION 7: STREAMING ========== */}
            <CollapsibleSection title="Streaming y Caster" icon="📺" badge={form.streaming?.casterName || form.streaming?.url ? 'Configurado' : null}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Caster (narrador)</label>
                        <input type="text" className={inputCls} value={form.streaming?.casterName || ''} onChange={(e) => updateStreaming('casterName', e.target.value)} placeholder="Nombre del caster" />
                    </div>
                    <div>
                        <label className={labelCls}>Host (anfitrión de sala)</label>
                        <input type="text" className={inputCls} value={form.streaming?.hostName || ''} onChange={(e) => updateStreaming('hostName', e.target.value)} placeholder="PSN ID del host" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelCls}>URL del stream</label>
                        <input type="url" className={inputCls} value={form.streaming?.url || ''} onChange={(e) => updateStreaming('url', e.target.value)} placeholder="https://youtube.com/live/..." />
                    </div>
                    <div>
                        <label className={labelCls}>Plataforma</label>
                        <select className={inputCls} value={form.streaming?.platform || ''} onChange={(e) => updateStreaming('platform', e.target.value)}>
                            <option value="">Seleccionar</option>
                            {STREAMING_PLATFORMS.map(p => (
                                <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 8: REGISTRATION ========== */}
            <CollapsibleSection title="Inscripción Pública" icon="📝" badge={form.registration?.enabled ? 'Activa' : null}>
                <ToggleSwitch
                    enabled={form.registration?.enabled}
                    onChange={(v) => updateRegistration('enabled', v)}
                    label="Inscripción abierta"
                    description="Permitir que los pilotos se inscriban desde la vista pública del evento"
                />
                {form.registration?.enabled && (
                    <div className="space-y-4 mt-3 pl-4 border-l-2 border-orange-500/30">
                        <ToggleSwitch
                            enabled={form.registration?.requiresApproval}
                            onChange={(v) => updateRegistration('requiresApproval', v)}
                            label="Requiere aprobación"
                            description="El admin debe aprobar cada inscripción manualmente"
                        />
                        <div>
                            <label className={labelCls}>Fecha límite de inscripción</label>
                            <input type="date" className={inputCls} value={form.registration?.deadline || ''} onChange={(e) => updateRegistration('deadline', e.target.value)} />
                            <p className="text-xs text-gray-500 mt-1">Dejar vacío para sin límite de tiempo</p>
                        </div>
                    </div>
                )}
            </CollapsibleSection>

            {/* ========== SECTION 9: PRIZES ========== */}
            <CollapsibleSection title="Premios y Notas" icon="🏆" badge={form.prizes ? 'Configurado' : null}>
                <textarea
                    className={inputCls}
                    rows={3}
                    value={form.prizes || ''}
                    onChange={(e) => updateField('prizes', e.target.value)}
                    placeholder="Descripción de premios (ej: Vinilo exclusivo para el ganador, mención en Discord...)"
                />
            </CollapsibleSection>

            {/* ========== SECTION 10: PARTICIPANTS ========== */}
            <CollapsibleSection
                title="Participantes"
                icon="👥"
                defaultOpen={isEditing && (form.participants?.length || 0) > 0}
                badge={`${form.participants?.length || 0}/${form.maxParticipants || 16}`}
            >
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">
                            {form.participants?.length || 0} de {form.maxParticipants || 16} participantes
                        </span>
                        <button type="button" onClick={addParticipant} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
                            ➕ Añadir Piloto
                        </button>
                    </div>

                    {(form.participants || []).length > 0 && (
                        <div className="bg-white/5 rounded-lg p-2">
                            {/* Header */}
                            <div className="flex gap-2 items-center px-2 py-1.5 text-xs text-gray-500 font-semibold uppercase border-b border-white/10 mb-1">
                                <span className="w-6 text-center">#</span>
                                <span className="flex-1">Nombre</span>
                                <span className="w-36">PSN ID</span>
                                <span className="w-8"></span>
                            </div>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {form.participants.map((p, idx) => (
                                    <div key={p.id || idx} className="flex gap-2 items-center px-2 py-1 hover:bg-white/5 rounded">
                                        <span className="text-gray-500 text-xs w-6 text-center">{idx + 1}</span>
                                        <input type="text" className="flex-1 bg-white/10 border border-white/20 rounded p-2 text-white text-sm focus:border-orange-500 outline-none" value={p.name || ''} onChange={(e) => updateParticipant(idx, 'name', e.target.value)} placeholder="Nombre del piloto" />
                                        <input type="text" className="w-36 bg-white/10 border border-white/20 rounded p-2 text-white text-sm focus:border-orange-500 outline-none" value={p.psnId || ''} onChange={(e) => updateParticipant(idx, 'psnId', e.target.value)} placeholder="PSN ID" />
                                        <button type="button" onClick={() => removeParticipant(idx)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white w-8 h-8 rounded flex items-center justify-center transition-colors flex-shrink-0">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            {/* ========== SECTION 11: RESULTS (completed events) ========== */}
            {form.status === 'completed' && (
                <CollapsibleSection title="Resultados del Evento" icon="🏁" defaultOpen={true} badge={form.results?.length ? `${form.results.length} posiciones` : null}>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Registra las posiciones finales</span>
                            <button type="button" onClick={addResult} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors">
                                ➕ Añadir Resultado
                            </button>
                        </div>
                        {(form.results || []).length > 0 && (
                            <div className="bg-white/5 rounded-lg p-2">
                                <div className="flex gap-2 items-center px-2 py-1.5 text-xs text-gray-500 font-semibold uppercase border-b border-white/10 mb-1">
                                    <span className="w-8 text-center">Pos</span>
                                    <span className="flex-1">Piloto</span>
                                    <span className="w-36">PSN ID</span>
                                    <span className="w-8"></span>
                                </div>
                                <div className="space-y-1">
                                    {form.results.map((r, idx) => (
                                        <div key={idx} className="flex gap-2 items-center px-2 py-1 hover:bg-white/5 rounded">
                                            <span className={`text-sm w-8 text-center font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                            </span>
                                            <input type="text" className="flex-1 bg-white/10 border border-white/20 rounded p-2 text-white text-sm focus:border-orange-500 outline-none" value={r.driverName || ''} onChange={(e) => updateResult(idx, 'driverName', e.target.value)} placeholder="Nombre del piloto" />
                                            <input type="text" className="w-36 bg-white/10 border border-white/20 rounded p-2 text-white text-sm focus:border-orange-500 outline-none" value={r.psnId || ''} onChange={(e) => updateResult(idx, 'psnId', e.target.value)} placeholder="PSN ID" />
                                            <button type="button" onClick={() => removeResult(idx)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white w-8 h-8 rounded flex items-center justify-center transition-colors flex-shrink-0">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* Bottom action bar */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 flex items-center justify-between">
                <button onClick={onCancel} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-gray-300 font-semibold rounded-lg transition-colors">
                    ← Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                >
                    {saving ? '⏳ Guardando...' : '💾 Guardar Evento'}
                </button>
            </div>
        </div>
    );
}

// ============================
// MAIN PAGE
// ============================

export default function EventsAdminPage() {
    const [view, setView] = useState('list');
    const [events, setEvents] = useState([]);
    const [editingEvent, setEditingEvent] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const fetched = await FirebaseService.getEvents();
            fetched.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setEvents(fetched);
        } catch (error) {
            console.error("Error fetching events:", error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleNewEvent = () => {
        const nextId = events.length > 0 ? Math.max(...events.map(e => parseInt(e.id, 10) || 0)) + 1 : 1;
        setEditingEvent(createNewEvent(nextId));
        setView('form');
    };

    const handleEditEvent = (event) => {
        setEditingEvent(event);
        setView('form');
    };

    const handleSaveEvent = async (eventData) => {
        try {
            setSaving(true);
            eventData.updatedAt = new Date().toISOString();
            if (!eventData.createdAt) eventData.createdAt = new Date().toISOString();
            await FirebaseService.saveEvent(eventData);
            await fetchEvents();
            setView('list');
            setEditingEvent(null);
        } catch (error) {
            console.error("Error saving event:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async (event) => {
        if (!confirm(`¿Eliminar "${event.title || 'Sin título'}"?\nEsta acción no se puede deshacer.`)) return;
        try {
            await FirebaseService.deleteEvent(event.id);
            await fetchEvents();
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Error al eliminar: " + error.message);
        }
    };

    const handleToggleStatus = async (event) => {
        const order = ['upcoming', 'live', 'completed'];
        const idx = order.indexOf(event.status || 'upcoming');
        const nextStatus = order[(idx + 1) % order.length];
        try {
            await FirebaseService.saveEvent({ ...event, status: nextStatus, updatedAt: new Date().toISOString() });
            await fetchEvents();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleDuplicateEvent = (event) => {
        const nextId = events.length > 0 ? Math.max(...events.map(e => parseInt(e.id, 10) || 0)) + 1 : 1;
        setEditingEvent({
            ...event,
            id: nextId,
            title: `${event.title} (copia)`,
            status: 'upcoming',
            participants: [],
            results: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        setView('form');
    };

    // Filtered events
    const filteredEvents = useMemo(() => {
        let filtered = events;
        if (statusFilter !== 'all') {
            filtered = filtered.filter(e => {
                const s = e.status || computeStatus(e);
                return s === statusFilter;
            });
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                (e.title || '').toLowerCase().includes(q) ||
                (e.track || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [events, statusFilter, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const upcoming = events.filter(e => (e.status || computeStatus(e)) === 'upcoming').length;
        const live = events.filter(e => e.status === 'live').length;
        const completed = events.filter(e => (e.status || computeStatus(e)) === 'completed').length;
        return { total: events.length, upcoming, live, completed };
    }, [events]);

    // Loading state
    if (loading) {
        return (
            <ProtectedRoute requireAdmin={true}>
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
                        <p className="text-white mt-4 text-xl">Cargando eventos...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requireAdmin={true}>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {view === 'form' ? (
                        <EventForm
                            event={editingEvent}
                            onSave={handleSaveEvent}
                            onCancel={() => { setView('list'); setEditingEvent(null); }}
                            saving={saving}
                        />
                    ) : (
                        <>
                            {/* ===== HEADER ===== */}
                            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                                            🎉 Gestión de Eventos Únicos
                                        </h1>
                                        <p className="text-gray-300">Crea, edita y gestiona eventos especiales independientes</p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all border border-white/30">
                                            🏠 Dashboard
                                        </button>
                                        <button onClick={() => window.location.href = '/championshipsAdmin'} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all border border-white/30">
                                            🏆 Campeonatos
                                        </button>
                                        <button onClick={handleNewEvent} className="px-5 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl">
                                            ➕ Nuevo Evento
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ===== STATS ===== */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {[
                                    { label: 'Total', value: stats.total, gradient: 'from-blue-600 to-blue-800', icon: '📊' },
                                    { label: 'Próximos', value: stats.upcoming, gradient: 'from-cyan-600 to-cyan-800', icon: '📅' },
                                    { label: 'En Vivo', value: stats.live, gradient: 'from-green-600 to-green-800', icon: '🔴' },
                                    { label: 'Finalizados', value: stats.completed, gradient: 'from-gray-600 to-gray-800', icon: '✅' }
                                ].map(s => (
                                    <div key={s.label} className={`bg-gradient-to-br ${s.gradient} rounded-lg p-4 text-center shadow-lg`}>
                                        <div className="text-2xl mb-1">{s.icon}</div>
                                        <div className="text-3xl font-bold text-white">{s.value}</div>
                                        <div className="text-white/70 text-sm">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* ===== FILTERS ===== */}
                            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 mb-6">
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { key: 'all', label: 'Todos', count: stats.total },
                                            { key: 'upcoming', label: '📅 Próximos', count: stats.upcoming },
                                            { key: 'live', label: '🔴 En Vivo', count: stats.live },
                                            { key: 'completed', label: '✅ Finalizados', count: stats.completed }
                                        ].map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setStatusFilter(tab.key)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${statusFilter === tab.key ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                            >
                                                {tab.label} ({tab.count})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex-1 w-full md:w-auto">
                                        <input
                                            type="text"
                                            className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/40 text-sm focus:border-orange-500 outline-none transition-colors"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="🔍 Buscar por título, pista o descripción..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ===== EVENT GRID ===== */}
                            {filteredEvents.length === 0 ? (
                                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-12 text-center">
                                    <div className="text-6xl mb-4">🎉</div>
                                    <p className="text-gray-300 text-lg mb-2">
                                        {events.length === 0 ? 'No hay eventos creados aún' : 'No se encontraron eventos con los filtros actuales'}
                                    </p>
                                    <p className="text-gray-500 text-sm mb-6">
                                        {events.length === 0 ? 'Crea tu primer evento especial' : 'Intenta cambiar los filtros o el texto de búsqueda'}
                                    </p>
                                    {events.length === 0 && (
                                        <button onClick={handleNewEvent} className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                                            ➕ Crear Primer Evento
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredEvents.map(event => {
                                        const status = event.status || computeStatus(event);
                                        const countdown = getCountdown(event.date, event.hour);
                                        const cat = EVENT_CATEGORIES.find(c => c.value === event.category);
                                        const fmt = EVENT_FORMATS.find(f => f.value === event.format);
                                        const hasStreaming = event.streaming?.casterName || event.streaming?.url;
                                        const hasRegistration = event.registration?.enabled;
                                        const participantCount = event.participants?.length || 0;
                                        const maxP = event.maxParticipants || 16;

                                        return (
                                            <div
                                                key={event.id}
                                                className={`bg-white/10 backdrop-blur-sm border rounded-lg overflow-hidden hover:bg-white/[0.13] transition-all duration-300 shadow-lg hover:shadow-xl group ${status === 'live' ? 'border-green-500/60 ring-2 ring-green-500/20' : 'border-white/20 hover:border-white/40'
                                                    }`}
                                            >
                                                {/* Banner */}
                                                <div className="relative h-36 bg-gradient-to-br from-gray-800 to-gray-900">
                                                    {event.banner ? (
                                                        <Image src={event.banner} alt={event.title || ''} width={800} height={200} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-orange-600/20 to-red-600/20">🏁</div>
                                                    )}
                                                    {/* Overlay badges */}
                                                    <div className="absolute top-2 left-2">
                                                        <StatusBadge status={status} />
                                                    </div>
                                                    {countdown && status === 'upcoming' && (
                                                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                                                            ⏳ {countdown}
                                                        </div>
                                                    )}
                                                    {status === 'live' && (
                                                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2.5 py-1 rounded-full animate-pulse font-bold flex items-center gap-1">
                                                            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                                                            EN VIVO
                                                        </div>
                                                    )}
                                                    {/* Bottom gradient for readability */}
                                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
                                                </div>

                                                {/* Content */}
                                                <div className="p-4 space-y-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white truncate" title={event.title}>{event.title || 'Sin título'}</h3>
                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                            {cat && <CategoryBadge category={event.category} />}
                                                            {fmt && event.format !== 'race' && (
                                                                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-medium">{fmt.label}</span>
                                                            )}
                                                            {hasRegistration && (
                                                                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded font-medium">📝 Inscripción</span>
                                                            )}
                                                            {hasStreaming && (
                                                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-medium">📺 Stream</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-sm space-y-1.5">
                                                        <div className="flex items-center gap-2 text-gray-300">
                                                            <span className="text-orange-400 w-5 text-center">📅</span>
                                                            <span>{formatEventDate(event.date)}</span>
                                                            {event.hour && <span className="text-gray-500">• 🕐 {event.hour}</span>}
                                                        </div>
                                                        {event.track && (
                                                            <div className="flex items-center gap-2 text-gray-300">
                                                                <span className="text-orange-400 w-5 text-center">🏁</span>
                                                                <span className="truncate">{event.track}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 text-gray-300">
                                                            <span className="text-orange-400 w-5 text-center">👥</span>
                                                            <span>{participantCount}/{maxP} participantes</span>
                                                            {participantCount >= maxP && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">LLENO</span>}
                                                        </div>
                                                        {event.streaming?.casterName && (
                                                            <div className="flex items-center gap-2 text-gray-300">
                                                                <span className="text-orange-400 w-5 text-center">🎙️</span>
                                                                <span>Caster: {event.streaming.casterName}</span>
                                                            </div>
                                                        )}
                                                        {event.streaming?.hostName && (
                                                            <div className="flex items-center gap-2 text-gray-300">
                                                                <span className="text-orange-400 w-5 text-center">🎮</span>
                                                                <span>Host: {event.streaming.hostName}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Quick info pills */}
                                                    {(event.rules?.tyreWear > 0 || event.rules?.fuelWear > 0 || event.weather?.timeOfDay) && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {event.rules?.tyreWear > 0 && <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">🔧 x{event.rules.tyreWear}</span>}
                                                            {event.rules?.fuelWear > 0 && <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">⛽ x{event.rules.fuelWear}</span>}
                                                            {event.weather?.timeOfDay && <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">🌦️ {event.weather.timeOfDay}</span>}
                                                            {(event.rules?.mandatoryTyres?.length > 0 || event.rules?.mandatoryTyre) && <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">🛞 {event.rules.mandatoryTyres?.join(', ') || event.rules.mandatoryTyre}</span>}
                                                        </div>
                                                    )}

                                                    {/* Results summary (completed events) */}
                                                    {status === 'completed' && event.results?.length > 0 && (
                                                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-sm">
                                                            <div className="text-yellow-400 font-semibold text-xs mb-1.5">🏆 RESULTADOS</div>
                                                            {event.results.slice(0, 3).map((r, i) => (
                                                                <div key={i} className="text-gray-300 text-xs flex items-center gap-1.5">
                                                                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                                                    <span>{r.driverName || 'Sin nombre'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Action buttons */}
                                                    <div className="flex gap-2 pt-2 border-t border-white/10">
                                                        <button
                                                            onClick={() => handleEditEvent(event)}
                                                            className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200"
                                                        >
                                                            ✏️ Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleStatus(event)}
                                                            className="px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600 text-yellow-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200"
                                                            title={`Cambiar a: ${EVENT_STATUSES[status === 'upcoming' ? 'live' : status === 'live' ? 'completed' : 'upcoming']?.label}`}
                                                        >
                                                            {EVENT_STATUSES[status === 'upcoming' ? 'live' : status === 'live' ? 'completed' : 'upcoming']?.icon}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicateEvent(event)}
                                                            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200"
                                                            title="Duplicar evento"
                                                        >
                                                            📋
                                                        </button>
                                                        {event.streaming?.url && (
                                                            <a
                                                                href={event.streaming.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200"
                                                                title="Ver stream"
                                                            >
                                                                📺
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteEvent(event)}
                                                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200"
                                                            title="Eliminar evento"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ===== FOOTER SUMMARY ===== */}
                            {events.length > 0 && (
                                <div className="mt-6 bg-white/5 border border-white/10 rounded-lg p-4 text-center text-gray-400 text-sm">
                                    Mostrando {filteredEvents.length} de {events.length} eventos
                                    {searchQuery && ` • Búsqueda: "${searchQuery}"`}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
