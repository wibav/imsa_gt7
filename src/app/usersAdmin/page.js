"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ADMIN_EMAILS } from '../context/AuthContext';
import { FirebaseService } from '../services/firebaseService';

export default function UsersAdmin() {
    const router = useRouter();
    const { currentUser, isAdmin, loading: authLoading } = useAuth();

    // Estado para gestión de comisarios
    const [comisarios, setComisarios] = useState([]);
    const [comisariosLoading, setComisariosLoading] = useState(false);
    const [newComisarioEmail, setNewComisarioEmail] = useState('');
    const [newComisarioName, setNewComisarioName] = useState('');
    const [comisarioSaving, setComisarioSaving] = useState(false);
    const [comisarioError, setComisarioError] = useState('');

    // Estado para nombres de admins
    const [adminNames, setAdminNames] = useState({});
    const [editingAdminName, setEditingAdminName] = useState(null);
    const [adminNameDraft, setAdminNameDraft] = useState('');
    const [adminNameSaving, setAdminNameSaving] = useState(false);

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    // Cargar datos al montar
    useEffect(() => {
        if (!authLoading && currentUser && isAdmin()) {
            loadComisarios();
            FirebaseService.getAdminNames(ADMIN_EMAILS).then(setAdminNames).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, currentUser]);

    const loadComisarios = async () => {
        setComisariosLoading(true);
        try {
            const data = await FirebaseService.getComisarios();
            setComisarios(data);
        } catch {
            setComisarios([]);
        } finally {
            setComisariosLoading(false);
        }
    };

    const handleAddComisario = async () => {
        setComisarioError('');
        const email = newComisarioEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            setComisarioError('Ingresa un email válido.');
            return;
        }
        setComisarioSaving(true);
        try {
            await FirebaseService.setUserRole(email, 'comisario', newComisarioName.trim());
            setNewComisarioEmail('');
            setNewComisarioName('');
            await loadComisarios();
        } catch (err) {
            setComisarioError('Error al guardar: ' + err.message);
        } finally {
            setComisarioSaving(false);
        }
    };

    const handleRemoveComisario = async (email) => {
        if (!window.confirm(`¿Quitar el rol de comisario a ${email}?`)) return;
        try {
            await FirebaseService.removeUserRole(email);
            await loadComisarios();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const handleSaveAdminName = async (email) => {
        setAdminNameSaving(true);
        try {
            await FirebaseService.setUserRole(email, 'admin', adminNameDraft.trim());
            setAdminNames(prev => ({ ...prev, [email]: adminNameDraft.trim() }));
            setEditingAdminName(null);
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setAdminNameSaving(false);
        }
    };

    if (authLoading) {
        return (
            <div className="p-8 text-gray-400 text-sm">Cargando…</div>
        );
    }

    if (!currentUser || !isAdmin()) {
        return (
            <div className="p-8 text-gray-400 text-sm">Acceso denegado.</div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-1">👥 Usuarios</h1>
            <p className="text-gray-400 text-sm mb-8">
                Los admins tienen acceso total. Los comisarios pueden ver las pistas y gestionar sanciones/reclamaciones, pero no la configuración del sistema.
            </p>

            {/* Admins */}
            <div className="mb-8 max-w-2xl">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">🔒 Administradores</h2>
                <div className="space-y-2">
                    {ADMIN_EMAILS.map(email => (
                        <div key={email} className="bg-white/10 border border-white/10 rounded-lg px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1 mr-3">
                                    {editingAdminName === email ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={adminNameDraft}
                                                onChange={e => setAdminNameDraft(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveAdminName(email);
                                                    if (e.key === 'Escape') setEditingAdminName(null);
                                                }}
                                                placeholder="Nombre del admin"
                                                className="flex-1 px-3 py-1 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-400"
                                            />
                                            <button
                                                onClick={() => handleSaveAdminName(email)}
                                                disabled={adminNameSaving}
                                                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm rounded-lg transition-all"
                                            >
                                                {adminNameSaving ? '…' : 'Guardar'}
                                            </button>
                                            <button
                                                onClick={() => setEditingAdminName(null)}
                                                className="px-2 py-1 text-gray-400 hover:text-white text-sm"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {adminNames[email] && <p className="text-white font-medium">{adminNames[email]}</p>}
                                            <p className={adminNames[email] ? 'text-gray-400 text-sm' : 'text-white font-medium'}>{email}</p>
                                        </>
                                    )}
                                </div>
                                {editingAdminName !== email && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full font-medium">Admin</span>
                                        <button
                                            onClick={() => {
                                                setEditingAdminName(email);
                                                setAdminNameDraft(adminNames[email] || '');
                                            }}
                                            className="p-1 text-gray-500 hover:text-white transition-all"
                                            title="Editar nombre"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Comisarios */}
            <div className="max-w-2xl">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">👮 Comisarios</h2>

                {/* Formulario para agregar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input
                        type="email"
                        placeholder="Email del comisario"
                        value={newComisarioEmail}
                        onChange={e => setNewComisarioEmail(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                        onKeyDown={e => e.key === 'Enter' && handleAddComisario()}
                    />
                    <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={newComisarioName}
                        onChange={e => setNewComisarioName(e.target.value)}
                        className="sm:w-44 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                    />
                    <button
                        onClick={handleAddComisario}
                        disabled={comisarioSaving}
                        className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
                    >
                        {comisarioSaving ? 'Guardando…' : '+ Agregar'}
                    </button>
                </div>
                {comisarioError && <p className="text-red-400 text-sm mb-4">{comisarioError}</p>}

                {/* Lista de comisarios */}
                {comisariosLoading ? (
                    <p className="text-gray-400 text-sm">Cargando…</p>
                ) : comisarios.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay comisarios asignados.</p>
                ) : (
                    <div className="space-y-2">
                        {comisarios.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-white/10 border border-white/10 rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-white font-medium">{c.email}</p>
                                    {c.displayName && <p className="text-gray-400 text-sm">{c.displayName}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium">Comisario</span>
                                    <button
                                        onClick={() => handleRemoveComisario(c.email)}
                                        className="px-3 py-1 bg-red-600/30 hover:bg-red-600/60 text-red-300 hover:text-white rounded-lg text-sm transition-all"
                                    >
                                        Quitar rol
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
