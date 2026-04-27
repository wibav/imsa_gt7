"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FirebaseService } from '../../services/firebaseService';
import {
    GT7_TRACKS,
    TYRE_OPTIONS,
    DAMAGE_OPTIONS,
    START_TIME_OPTIONS,
    TIME_MULTIPLIER_OPTIONS,
    WEATHER_CONDITION_OPTIONS,
    WEATHER_TRANSITION_OPTIONS,
    DEFAULT_SPRINT_POINTS,
} from '../../utils/constants';

// ─── Constantes locales ──────────────────────────────────────────────────────

const YES_NO = [
    { value: 'yes', label: 'Sí' },
    { value: 'no', label: 'No' },
];

const WEATHER_OPTIONS = [
    { value: 'clear', label: 'Despejado' },
    { value: 'rain', label: 'Lluvia' },
    { value: 'variable', label: 'Variable' },
];

const TIME_OPTIONS = [
    { value: 'day', label: 'Día' },
    { value: 'night', label: 'Noche' },
    { value: 'dynamic', label: 'Dinámico' },
];

const ASSIST_OPTIONS = [
    { value: 'default', label: 'Predeterminado' },
    { value: 'off', label: 'Desactivado' },
    { value: 'on', label: 'Activado' },
];

const ABS_OPTIONS = [
    { value: 'default', label: 'Predeterminado' },
    { value: 'off', label: 'Desactivado' },
    { value: 'weak', label: 'Débil' },
];

const PENALTY_SHORTCUT_OPTIONS = [
    { value: 'off', label: 'Desactivado' },
    { value: 'weak', label: 'Leve' },
    { value: 'moderate', label: 'Moderado' },
    { value: 'strong', label: 'Fuerte' },
];

const ON_OFF_OPTIONS = [
    { value: 'on', label: 'Activado' },
    { value: 'off', label: 'Desactivado' },
];

// ─── Valor por defecto de una pista vacía ────────────────────────────────────

export function getEmptyTrackData(tracksCount = 0, firstCategory = '') {
    return {
        name: '',
        layoutImage: '',
        date: '',
        round: tracksCount + 1,
        category: firstCategory,
        raceType: 'carrera',
        laps: 10,
        duration: 60,
        sprintLaps: 5,
        rules: {
            weather: 'clear',
            timeOfDay: 'day',
            weatherSlots: [],
            timeMultiplier: 1,
            startTime: '',
            tireWear: 5,
            fuelConsumption: 1,
            fuelRefillRate: 10,
            mandatoryTyre: [],
            mandatoryPitStops: 0,
            mandatoryCompoundChanges: false,
            mechanicalDamage: 'No',
            bop: 'yes',
            adjustments: 'no',
            engineSwap: 'no',
            penalties: 'yes',
            penaltyShortcut: 'moderate',
            penaltyWall: 'on',
            penaltyPitLine: 'on',
            penaltyCarCollision: 'on',
            abs: 'default',
            tcs: 'no',
            asm: 'no',
            counterSteering: 'no',
            qualySlipstream: false,
            raceSlipstream: true,
            qualyTireWear: false,
            startingFuel: 100,
            notes: '',
        },
        specificCars: false,
        allowedCars: [],
    };
}

// ─── Helpers de render ───────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${checked ? 'bg-orange-600' : 'bg-gray-600'}`}
        >
            <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`}
            />
        </button>
    );
}

function RuleSelect({ value, onChange, options }) {
    return (
        <select
            value={value}
            onChange={onChange}
            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
            {options.map(opt => (
                <option
                    key={typeof opt === 'string' ? opt : opt.value}
                    value={typeof opt === 'string' ? opt : opt.value}
                    className="bg-slate-800"
                >
                    {typeof opt === 'string' ? opt : opt.label}
                </option>
            ))}
        </select>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────

/**
 * Modal reutilizable para crear/editar un circuito.
 *
 * @param {{ track: object|null, championship: object|null, onSave: (data) => Promise<void>|void, onClose: () => void }} props
 *   - track       → datos iniciales (null = nuevo)
 *   - championship → campeonato actual (para categorías)
 *   - onSave      → callback con los datos del circuito listo para guardar
 *   - onClose     → cierra el modal
 */
export default function TrackFormModal({ track, championship, onSave, onClose }) {
    const [tab, setTab] = useState('info');
    const [saving, setSaving] = useState(false);
    const [firebaseTracks, setFirebaseTracks] = useState([]);
    const [uploadingImage, setUploadingImage] = useState(false);

    const categories = championship?.categories || [];

    // Inicializar form con los datos de la pista (o vacío)
    const [form, setForm] = useState(() => {
        if (track) {
            return {
                ...getEmptyTrackData(0, categories[0] || ''),
                ...track,
                rules: {
                    ...getEmptyTrackData().rules,
                    ...(track.rules || {}),
                },
            };
        }
        return getEmptyTrackData(0, categories[0] || '');
    });

    // Cargar circuitos de Firebase (para el selector con imagen)
    useEffect(() => {
        FirebaseService.getTracks()
            .then(data => setFirebaseTracks(data || []))
            .catch(() => { });
    }, []);

    // ── Handlers ────────────────────────────────────────────────────────────

    const setRule = (field, value) =>
        setForm(prev => ({ ...prev, rules: { ...prev.rules, [field]: value } }));

    const handleSelectTrack = (name) => {
        const fb = firebaseTracks.find(t => t.name === name);
        setForm(prev => ({ ...prev, name, layoutImage: fb?.layoutImage || prev.layoutImage }));
    };

    const handleAddAllowedCar = (name) => {
        const trimmed = name?.trim();
        if (trimmed && !(form.allowedCars || []).includes(trimmed)) {
            setForm(prev => ({ ...prev, allowedCars: [...(prev.allowedCars || []), trimmed] }));
        }
    };

    const handleRemoveAllowedCar = (idx) =>
        setForm(prev => ({ ...prev, allowedCars: prev.allowedCars.filter((_, i) => i !== idx) }));

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Por favor selecciona una imagen'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('La imagen supera el máximo de 5 MB'); return; }
        try {
            setUploadingImage(true);
            const path = `tracks/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            const url = await FirebaseService.uploadImage(file, path);
            setForm(prev => ({ ...prev, layoutImage: url }));
        } catch (err) {
            alert('Error al subir imagen: ' + err.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        if (!form.name) { alert('Debe seleccionar un circuito'); return; }
        if (!form.date) { alert('Debe indicar una fecha'); return; }
        setSaving(true);
        try {
            await onSave({ ...form, round: parseInt(form.round) || 1 });
        } finally {
            setSaving(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    const TABS = [
        { id: 'info', label: '📍 Circuito' },
        { id: 'qualy', label: '🎯 Qualy' },
        { id: 'carrera', label: '⚙️ Carrera' },
        { id: 'reglas', label: '🚦 Reglas' },
    ];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">

                {/* Header sticky */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-blue-900 border-b border-white/20 z-10">
                    <div className="flex justify-between items-center px-6 pt-6 pb-4">
                        <h3 className="text-2xl font-bold text-white">
                            {track ? '✏️ Editar Circuito' : '➕ Agregar Circuito'}
                        </h3>
                        <button onClick={onClose} className="text-white hover:text-red-400 text-3xl transition-colors">×</button>
                    </div>
                    <div className="flex border-t border-white/10">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`flex-1 py-3 px-2 text-sm font-medium transition-all border-b-2 ${tab === t.id
                                    ? 'border-orange-500 text-orange-400 bg-white/5'
                                    : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 space-y-6">

                    {/* ══════════════ TAB: Circuito ══════════════ */}
                    {tab === 'info' && (
                        <>
                            {/* Selector de circuito */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-4">📍 Información del Circuito</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🏁 Seleccionar Circuito *</label>
                                        <select
                                            value={form.name}
                                            onChange={e => handleSelectTrack(e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="" className="bg-slate-800">Seleccionar circuito...</option>
                                            {firebaseTracks.length > 0 && (
                                                <optgroup label="🖼️ Circuitos con Imagen" className="bg-slate-800">
                                                    {firebaseTracks.map(t => (
                                                        <option key={t.id} value={t.name} className="bg-slate-800">{t.name} ✨</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {(() => {
                                                const dbNames = firebaseTracks.map(t => t.name);
                                                const remaining = GT7_TRACKS.filter(n => !dbNames.includes(n));
                                                return remaining.length > 0 ? (
                                                    <optgroup label="🎮 Gran Turismo 7" className="bg-slate-800">
                                                        {remaining.map(n => (
                                                            <option key={n} value={n} className="bg-slate-800">{n}</option>
                                                        ))}
                                                    </optgroup>
                                                ) : null;
                                            })()}
                                        </select>
                                        {form.name && (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-xs text-gray-400">
                                                    Seleccionado: <span className="text-white font-medium">{form.name}</span>
                                                </p>
                                                {form.layoutImage && (
                                                    <p className="text-xs text-green-400 flex items-center gap-1">
                                                        <span>✅</span><span>Tiene imagen de layout</span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">📅 Fecha *</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">#️⃣ Ronda</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={form.round}
                                            onChange={e => setForm(prev => ({ ...prev, round: parseInt(e.target.value) || 1 }))}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    {categories.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🏎️ Categoría</label>
                                            <select
                                                value={form.category}
                                                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="" className="bg-slate-800">Seleccionar...</option>
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Imagen del circuito (si no tiene una de Firebase) */}
                            {!form.layoutImage && (
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">🖼️ Imagen del Circuito</h4>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:cursor-pointer hover:file:bg-orange-700"
                                    />
                                    {uploadingImage && <p className="text-sm text-orange-400 mt-2">⏳ Subiendo imagen...</p>}
                                </div>
                            )}
                            {form.layoutImage && (
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-300 font-medium">🖼️ Vista previa del circuito</span>
                                        <button
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, layoutImage: '' }))}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            🗑️ Quitar imagen
                                        </button>
                                    </div>
                                    <div className="relative w-full h-48 bg-black/30 rounded-lg overflow-hidden">
                                        <Image src={form.layoutImage} alt="Layout" fill className="object-contain p-2" />
                                    </div>
                                </div>
                            )}

                            {/* Tipo de Carrera */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-4">🏁 Tipo de Carrera</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Carrera *</label>
                                        <select
                                            value={form.raceType}
                                            onChange={e => setForm(prev => ({ ...prev, raceType: e.target.value }))}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="carrera">🏁 Carrera — Por número de vueltas</option>
                                            <option value="resistencia">⏱️ Resistencia — Por tiempo determinado</option>
                                            <option value="sprint_carrera">⚡ Sprint + Carrera — Formato dual</option>
                                        </select>
                                    </div>

                                    {form.raceType === 'carrera' && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔄 Número de Vueltas *</label>
                                            <input
                                                type="number" min="1"
                                                value={form.laps}
                                                onChange={e => setForm(prev => ({ ...prev, laps: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Ej: 10"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">La carrera terminará al completar este número de vueltas</p>
                                        </div>
                                    )}
                                    {form.raceType === 'resistencia' && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⏱️ Duración (minutos) *</label>
                                            <input
                                                type="number" min="1"
                                                value={form.duration}
                                                onChange={e => setForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Ej: 60"
                                            />
                                        </div>
                                    )}
                                    {form.raceType === 'sprint_carrera' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">⚡ Vueltas Sprint</label>
                                                <input
                                                    type="number" min="1"
                                                    value={form.sprintLaps || 5}
                                                    onChange={e => setForm(prev => ({ ...prev, sprintLaps: parseInt(e.target.value) || 5 }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Carrera corta con puntuación reducida</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">🏁 Vueltas Carrera Principal</label>
                                                <input
                                                    type="number" min="1"
                                                    value={form.laps}
                                                    onChange={e => setForm(prev => ({ ...prev, laps: parseInt(e.target.value) || 10 }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Carrera principal con puntuación completa</p>
                                            </div>
                                            <div className="md:col-span-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                                <span className="text-purple-400 font-bold text-sm">⚡ Sistema Sprint + Carrera</span>
                                                <p className="text-gray-400 text-xs mt-1">
                                                    Sprint: Puntuación reducida (P1={DEFAULT_SPRINT_POINTS[1]}pts, P2={DEFAULT_SPRINT_POINTS[2]}pts...) •
                                                    Carrera: Puntuación completa según el sistema de puntos del campeonato
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB: Qualy ══════════════ */}
                    {tab === 'qualy' && (
                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                            <h4 className="text-xl font-bold text-white mb-1">🎯 Clasificación (Qualy)</h4>
                            <p className="text-xs text-gray-400 mb-4">Configuración específica para la sesión de clasificación</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300">💨 Rebufo (Slipstream)</label>
                                        <p className="text-xs text-gray-400">Efecto de succión entre coches en qualy</p>
                                    </div>
                                    <Toggle
                                        checked={form.rules.qualySlipstream ?? false}
                                        onChange={() => setRule('qualySlipstream', !(form.rules.qualySlipstream ?? false))}
                                    />
                                </div>
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300">🛞 Desgaste de Neumáticos</label>
                                        <p className="text-xs text-gray-400">Activar desgaste durante la qualy</p>
                                    </div>
                                    <Toggle
                                        checked={form.rules.qualyTireWear ?? false}
                                        onChange={() => setRule('qualyTireWear', !(form.rules.qualyTireWear ?? false))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════ TAB: Carrera ══════════════ */}
                    {tab === 'carrera' && (
                        <>
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-1">⚙️ Reglas de Carrera</h4>
                                <p className="text-xs text-gray-400 mb-4">Configuración para la sesión de carrera</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300">💨 Rebufo (Slipstream)</label>
                                            <p className="text-xs text-gray-400">Efecto de succión en carrera</p>
                                        </div>
                                        <Toggle
                                            checked={form.rules.raceSlipstream ?? true}
                                            onChange={() => setRule('raceSlipstream', !(form.rules.raceSlipstream ?? true))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⛽ Combustible Inicial (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="100" step="5"
                                                value={form.rules.startingFuel ?? 100}
                                                onChange={e => setRule('startingFuel', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-white font-medium w-12">{form.rules.startingFuel ?? 100}%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🌤️ Clima</label>
                                        <RuleSelect
                                            value={form.rules.weather}
                                            onChange={e => setRule('weather', e.target.value)}
                                            options={WEATHER_OPTIONS}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🕐 Hora del Día</label>
                                        <RuleSelect
                                            value={form.rules.timeOfDay}
                                            onChange={e => setRule('timeOfDay', e.target.value)}
                                            options={TIME_OPTIONS}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⏰ Hora de Inicio</label>
                                        <select
                                            value={form.rules.startTime || ''}
                                            onChange={e => setRule('startTime', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {START_TIME_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⏩ Velocidad del Tiempo</label>
                                        <select
                                            value={form.rules.timeMultiplier ?? 1}
                                            onChange={e => setRule('timeMultiplier', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {TIME_MULTIPLIER_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Clima dinámico */}
                                    {form.rules.weather === 'variable' && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-3">🌦️ Slots de Clima Dinámico</label>
                                            {(form.rules.weatherSlots || []).map((slot, idx) => (
                                                <div key={idx} className="flex items-center gap-2 mb-2">
                                                    <span className="text-white text-xs w-8">#{idx + 1}</span>
                                                    <select
                                                        value={slot.weather}
                                                        onChange={e => {
                                                            const slots = [...(form.rules.weatherSlots || [])];
                                                            slots[idx] = { ...slots[idx], weather: e.target.value };
                                                            setRule('weatherSlots', slots);
                                                        }}
                                                        className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                                                    >
                                                        {WEATHER_CONDITION_OPTIONS.map(o => (
                                                            <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={slot.transition || 'gradual'}
                                                        onChange={e => {
                                                            const slots = [...(form.rules.weatherSlots || [])];
                                                            slots[idx] = { ...slots[idx], transition: e.target.value };
                                                            setRule('weatherSlots', slots);
                                                        }}
                                                        className="w-36 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                                                    >
                                                        {WEATHER_TRANSITION_OPTIONS.map(o => (
                                                            <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRule('weatherSlots', (form.rules.weatherSlots || []).filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-300 text-sm"
                                                    >🗑</button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setRule('weatherSlots', [...(form.rules.weatherSlots || []), { weather: 'rain', transition: 'gradual' }])}
                                                className="text-sm text-orange-400 hover:text-orange-300 mt-1"
                                            >
                                                ➕ Agregar slot de clima
                                            </button>
                                        </div>
                                    )}

                                    {/* Desgastes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🛞 Desgaste de Neumáticos</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="50"
                                                value={typeof form.rules.tireWear === 'number' ? form.rules.tireWear : 5}
                                                onChange={e => setRule('tireWear', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-white font-medium w-12">x{typeof form.rules.tireWear === 'number' ? form.rules.tireWear : form.rules.tireWear}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⛽ Consumo de Combustible</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="50"
                                                value={typeof form.rules.fuelConsumption === 'number' ? form.rules.fuelConsumption : 1}
                                                onChange={e => setRule('fuelConsumption', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-white font-medium w-12">x{typeof form.rules.fuelConsumption === 'number' ? form.rules.fuelConsumption : form.rules.fuelConsumption}</span>
                                        </div>
                                    </div>

                                    {(typeof form.rules.fuelConsumption === 'number' ? form.rules.fuelConsumption > 0 : form.rules.fuelConsumption === 'yes') && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🚰 Velocidad de Recarga</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range" min="1" max="20"
                                                    value={form.rules.fuelRefillRate || 10}
                                                    onChange={e => setRule('fuelRefillRate', parseInt(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <span className="text-white font-medium w-16">{form.rules.fuelRefillRate || 10} L/s</span>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🛣️ Pit Stops Obligatorios</label>
                                        <input
                                            type="number" min="0" max="10"
                                            value={form.rules.mandatoryPitStops ?? 0}
                                            onChange={e => setRule('mandatoryPitStops', parseInt(e.target.value) || 0)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">0 = sin obligación de parada</p>
                                    </div>

                                    {(form.rules.mandatoryPitStops ?? 0) > 0 && (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300">🔄 Cambio de Compuesto Obligatorio</label>
                                                <p className="text-xs text-gray-400">Debe usar al menos 2 compuestos distintos</p>
                                            </div>
                                            <Toggle
                                                checked={form.rules.mandatoryCompoundChanges ?? false}
                                                onChange={() => setRule('mandatoryCompoundChanges', !(form.rules.mandatoryCompoundChanges ?? false))}
                                            />
                                        </div>
                                    )}

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-3">🏁 Neumáticos Obligatorios</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {TYRE_OPTIONS.map(tyre => {
                                                const selected = Array.isArray(form.rules.mandatoryTyre) && form.rules.mandatoryTyre.includes(tyre.value);
                                                return (
                                                    <label
                                                        key={tyre.value}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${selected
                                                            ? 'bg-orange-600/30 border-orange-500 text-white'
                                                            : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            onChange={e => {
                                                                const cur = Array.isArray(form.rules.mandatoryTyre) ? form.rules.mandatoryTyre : [];
                                                                setRule('mandatoryTyre', e.target.checked ? [...cur, tyre.value] : cur.filter(t => t !== tyre.value));
                                                            }}
                                                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-600"
                                                        />
                                                        <span className="font-medium text-sm">{tyre.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB: Reglas ══════════════ */}
                    {tab === 'reglas' && (
                        <>
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-1">⚙️ Configuración de Carrera</h4>
                                <p className="text-xs text-gray-400 mb-4">Parámetros adicionales de simulación</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🔧 Daños</label>
                                        <RuleSelect
                                            value={form.rules.mechanicalDamage}
                                            onChange={e => setRule('mechanicalDamage', e.target.value)}
                                            options={DAMAGE_OPTIONS}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⚖️ Balance de Prestaciones (BoP)</label>
                                        <RuleSelect value={form.rules.bop} onChange={e => setRule('bop', e.target.value)} options={YES_NO} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🔧 Ajustes del Vehículo</label>
                                        <RuleSelect value={form.rules.adjustments} onChange={e => setRule('adjustments', e.target.value)} options={YES_NO} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🔄 Intercambio de Motor</label>
                                        <RuleSelect value={form.rules.engineSwap} onChange={e => setRule('engineSwap', e.target.value)} options={YES_NO} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">⚠️ Penalizaciones (General)</label>
                                        <RuleSelect value={form.rules.penalties} onChange={e => setRule('penalties', e.target.value)} options={YES_NO} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-1">🚦 Penalizaciones Específicas</h4>
                                <p className="text-xs text-gray-400 mb-4">Comportamiento de cada tipo de penalización en GT7</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🔀 Penalización por Atajo</label>
                                        <RuleSelect value={form.rules.penaltyShortcut ?? 'moderate'} onChange={e => setRule('penaltyShortcut', e.target.value)} options={PENALTY_SHORTCUT_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🧱 Penalización por Contacto con Muro</label>
                                        <RuleSelect value={form.rules.penaltyWall ?? 'on'} onChange={e => setRule('penaltyWall', e.target.value)} options={ON_OFF_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">🏎️ Penalización por Pisar Línea de Box</label>
                                        <RuleSelect value={form.rules.penaltyPitLine ?? 'on'} onChange={e => setRule('penaltyPitLine', e.target.value)} options={ON_OFF_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">💥 Penalización por Golpe a Otro Coche</label>
                                        <RuleSelect value={form.rules.penaltyCarCollision ?? 'on'} onChange={e => setRule('penaltyCarCollision', e.target.value)} options={ON_OFF_OPTIONS} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-4">🎮 Asistencias de Conducción</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">ABS (Frenos Antibloqueo)</label>
                                        <RuleSelect value={form.rules.abs || 'default'} onChange={e => setRule('abs', e.target.value)} options={ABS_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">TCS (Control de Tracción)</label>
                                        <RuleSelect value={form.rules.tcs || 'default'} onChange={e => setRule('tcs', e.target.value)} options={ASSIST_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">ASM (Control de Estabilidad)</label>
                                        <RuleSelect value={form.rules.asm || 'default'} onChange={e => setRule('asm', e.target.value)} options={ASSIST_OPTIONS} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Contravolante</label>
                                        <RuleSelect value={form.rules.counterSteering || 'default'} onChange={e => setRule('counterSteering', e.target.value)} options={ASSIST_OPTIONS} />
                                    </div>
                                </div>
                            </div>

                            {/* Carros específicos */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-xl font-bold text-white">🚗 Carros Específicos</h4>
                                        <p className="text-sm text-gray-400">Limita los carros permitidos para este circuito</p>
                                    </div>
                                    <Toggle
                                        checked={form.specificCars}
                                        onChange={() => setForm(prev => ({ ...prev, specificCars: !prev.specificCars, allowedCars: !prev.specificCars ? (prev.allowedCars || []) : [] }))}
                                    />
                                </div>
                                {form.specificCars && (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre del carro (ej: Mazda RX-Vision GT3)"
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllowedCar(e.target.value); e.target.value = ''; } }}
                                                className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={e => { const inp = e.target.previousSibling; handleAddAllowedCar(inp.value); inp.value = ''; }}
                                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                        {(form.allowedCars || []).length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-sm text-gray-400">{form.allowedCars.length} carros permitidos:</p>
                                                {form.allowedCars.map((car, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                                                        <span className="text-white text-sm">{car}</span>
                                                        <button type="button" onClick={() => handleRemoveAllowedCar(idx)} className="text-red-400 hover:text-red-300 text-sm">🗑️</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Notas */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                <h4 className="text-xl font-bold text-white mb-4">📝 Notas del Circuito</h4>
                                <textarea
                                    value={form.rules.notes || ''}
                                    onChange={e => setRule('notes', e.target.value)}
                                    rows={4}
                                    placeholder="Reglas especiales, instrucciones adicionales..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                                />
                                <p className="text-xs text-gray-400 mt-2">Estas notas serán visibles para todos los pilotos</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer sticky */}
                <div className="sticky bottom-0 bg-gradient-to-r from-slate-900 to-blue-900 p-6 border-t border-white/20">
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || uploadingImage}
                            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                            {saving ? '⏳ Guardando...' : track ? '💾 Guardar Cambios' : '➕ Agregar Circuito'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
