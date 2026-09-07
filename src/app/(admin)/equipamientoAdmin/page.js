"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { FirebaseService } from '../../services/firebaseService';

const COLOR_PRESETS = [
    { name: 'Naranja', value: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    { name: 'Amarillo', value: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    { name: 'Verde', value: 'bg-green-500/20 text-green-300 border-green-500/30' },
    { name: 'Azul', value: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { name: 'Morado', value: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { name: 'Rojo', value: 'bg-red-500/20 text-red-300 border-red-500/30' },
    { name: 'Cian', value: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
];

const EMPTY_FORM = { title: '', description: '', url: '', emoji: '🏎️', tag: '', tagColor: COLOR_PRESETS[0].value };

export default function EquipamientoAdmin() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();

    const [items, setItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    useEffect(() => {
        if (!authLoading && currentUser && isPlatformOwner()) {
            loadItems();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, currentUser]);

    const loadItems = async () => {
        setItemsLoading(true);
        try {
            setItems(await FirebaseService.getEquipmentItems());
        } finally {
            setItemsLoading(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({ title: item.title, description: item.description, url: item.url, emoji: item.emoji, tag: item.tag, tagColor: item.tagColor });
        setError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError('');
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.url.trim() || !form.tag.trim()) {
            setError('Título, URL y etiqueta son obligatorios.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            if (editingId) {
                const result = await FirebaseService.updateEquipmentItem(editingId, form);
                if (!result.success) throw new Error(result.error);
            } else {
                const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.order ?? 0)) + 1 : 0;
                const result = await FirebaseService.createEquipmentItem(form, nextOrder);
                if (!result.success) throw new Error(result.error);
            }
            await loadItems();
            cancelEdit();
        } catch (err) {
            setError(err.message || 'Error al guardar el producto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (itemId) => {
        if (!confirm('¿Eliminar este producto del catálogo?')) return;
        await FirebaseService.deleteEquipmentItem(itemId);
        await loadItems();
    };

    const moveItem = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        const a = items[index];
        const b = items[targetIndex];
        await Promise.all([
            FirebaseService.updateEquipmentItem(a.id, { order: b.order ?? targetIndex }),
            FirebaseService.updateEquipmentItem(b.id, { order: a.order ?? index }),
        ]);
        await loadItems();
    };

    if (authLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la administra el Administrador de Plataforma.</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-1">🛒 Equipamiento</h1>
            <p className="text-gray-400 text-sm mb-8">
                Catálogo global de productos recomendados (enlaces de afiliado Amazon), visible en /equipamiento para todas las organizaciones.
            </p>

            {/* Formulario */}
            <div className="mb-8 max-w-2xl bg-white/5 border border-white/10 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {editingId ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <div className="grid gap-3">
                    <input
                        type="text"
                        placeholder="Título"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                    />
                    <textarea
                        placeholder="Descripción"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 resize-none"
                    />
                    <input
                        type="url"
                        placeholder="URL (Amazon)"
                        value={form.url}
                        onChange={e => setForm({ ...form, url: e.target.value })}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                    />
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Emoji"
                            value={form.emoji}
                            onChange={e => setForm({ ...form, emoji: e.target.value })}
                            className="w-20 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 text-center"
                        />
                        <input
                            type="text"
                            placeholder="Etiqueta (ej. Volante)"
                            value={form.tag}
                            onChange={e => setForm({ ...form, tag: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                        />
                        <select
                            value={form.tagColor}
                            onChange={e => setForm({ ...form, tagColor: e.target.value })}
                            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-400"
                        >
                            {COLOR_PRESETS.map(c => (
                                <option key={c.value} value={c.value} className="text-black">{c.name}</option>
                            ))}
                        </select>
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
                        >
                            {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar producto'}
                        </button>
                        {editingId && (
                            <button
                                onClick={cancelEdit}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Listado */}
            <div className="max-w-2xl">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Productos ({items.length})
                </h2>
                {itemsLoading ? (
                    <p className="text-gray-500 text-sm">Cargando…</p>
                ) : items.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sin productos todavía.</p>
                ) : (
                    <div className="space-y-2">
                        {items.map((item, idx) => (
                            <div key={item.id} className="bg-white/10 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-white font-medium truncate">{item.emoji} {item.title}</p>
                                    <p className="text-gray-400 text-xs truncate">{item.tag}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-all" title="Subir">⬆️</button>
                                    <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-all" title="Bajar">⬇️</button>
                                    <button onClick={() => startEdit(item)} className="p-1 text-gray-500 hover:text-white transition-all" title="Editar">✏️</button>
                                    <button onClick={() => handleDelete(item.id)} className="px-2 py-1 bg-red-600/30 hover:bg-red-600/60 text-red-300 hover:text-white rounded-lg text-xs transition-all">Quitar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
