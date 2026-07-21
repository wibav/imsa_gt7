"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { FirebaseService } from '../services/firebaseService';

export default function UsersAdmin() {
    const router = useRouter();
    const { currentUser, isAdmin, resetPassword, loading: authLoading } = useAuth();
    const { orgId } = useOrganization();

    // Estado para gestión de admins
    const [admins, setAdmins] = useState([]);
    const [adminsLoading, setAdminsLoading] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [adminSaving, setAdminSaving] = useState(false);
    const [adminError, setAdminError] = useState('');
    const [editingAdminName, setEditingAdminName] = useState(null);
    const [adminNameDraft, setAdminNameDraft] = useState('');
    const [adminNameSaving, setAdminNameSaving] = useState(false);

    // Estado para gestión de comisarios
    const [comisarios, setComisarios] = useState([]);
    const [comisariosLoading, setComisariosLoading] = useState(false);
    const [newComisarioEmail, setNewComisarioEmail] = useState('');
    const [newComisarioName, setNewComisarioName] = useState('');
    const [comisarioSaving, setComisarioSaving] = useState(false);
    const [comisarioError, setComisarioError] = useState('');

    // Feedback de "cuenta nueva creada, se envió correo de restablecimiento"
    const [accountCreatedNotice, setAccountCreatedNotice] = useState('');
    // Si sendPasswordResetEmail falla, se guarda el email para poder reintentar
    // (antes el error se descartaba en silencio con .catch(()=>{}) y la UI
    // igual decía "se envió", sin ninguna forma de saber que en realidad falló).
    const [emailFailedFor, setEmailFailedFor] = useState('');
    const [resendingEmail, setResendingEmail] = useState(false);

    const sendWelcomeEmail = async (email) => {
        try {
            await resetPassword(email);
            setEmailFailedFor('');
            setAccountCreatedNotice(`Se creó una cuenta nueva para ${email} y se le envió un correo para que defina su contraseña.`);
        } catch (err) {
            setEmailFailedFor(email);
            setAccountCreatedNotice(
                `Se creó la cuenta para ${email}, pero el correo para definir la contraseña NO se pudo enviar` +
                (err.code ? ` (${err.code})` : '') + '. Revisa spam o usa el botón de reenviar.'
            );
        }
    };

    const handleResendEmail = async () => {
        if (!emailFailedFor) return;
        setResendingEmail(true);
        try {
            await sendWelcomeEmail(emailFailedFor);
        } finally {
            setResendingEmail(false);
        }
    };

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    // Cargar datos al montar (y si cambia la organización activa)
    useEffect(() => {
        if (!authLoading && currentUser && isAdmin()) {
            loadAdmins();
            loadComisarios();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, currentUser, orgId]);

    const loadAdmins = async () => {
        setAdminsLoading(true);
        try {
            const data = await FirebaseService.getAdmins(orgId);
            setAdmins(data);
        } catch {
            setAdmins([]);
        } finally {
            setAdminsLoading(false);
        }
    };

    const loadComisarios = async () => {
        setComisariosLoading(true);
        try {
            const data = await FirebaseService.getComisarios(orgId);
            setComisarios(data);
        } catch {
            setComisarios([]);
        } finally {
            setComisariosLoading(false);
        }
    };

    const handleAddAdmin = async () => {
        setAdminError('');
        const email = newAdminEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            setAdminError('Ingresa un email válido.');
            return;
        }
        setAdminSaving(true);
        setAccountCreatedNotice('');
        setEmailFailedFor('');
        try {
            // Nuevos admins se agregan como "director_liga" — "organizador"
            // (dueño de la organización) es un rol especial, no se otorga
            // desde este formulario genérico.
            const result = await FirebaseService.setUserRole(email, orgId, 'director_liga', newAdminName.trim());
            if (result.created) {
                // La Cloud Function creó la cuenta con una contraseña
                // aleatoria que nunca se expone — el usuario la define él
                // mismo al abrir el enlace de este correo.
                await sendWelcomeEmail(email);
            }
            setNewAdminEmail('');
            setNewAdminName('');
            await loadAdmins();
        } catch (err) {
            setAdminError('Error al guardar: ' + err.message);
        } finally {
            setAdminSaving(false);
        }
    };

    const handleRemoveAdmin = async (email) => {
        if (email === currentUser.email) {
            alert('No puedes quitarte el rol de admin a ti mismo.');
            return;
        }
        if (!window.confirm(`¿Quitar el rol de admin a ${email}?`)) return;
        try {
            await FirebaseService.removeUserRole(email, orgId);
            await loadAdmins();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const handleSaveAdminName = async (email, role) => {
        setAdminNameSaving(true);
        try {
            await FirebaseService.setUserRole(email, orgId, role, adminNameDraft.trim());
            setEditingAdminName(null);
            await loadAdmins();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setAdminNameSaving(false);
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
        setAccountCreatedNotice('');
        setEmailFailedFor('');
        try {
            const result = await FirebaseService.setUserRole(email, orgId, 'comisario', newComisarioName.trim());
            if (result.created) {
                await sendWelcomeEmail(email);
            }
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
            await FirebaseService.removeUserRole(email, orgId);
            await loadComisarios();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
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
                Si el email no tiene cuenta todavía, se crea automáticamente y se le envía un correo para que defina su contraseña.
            </p>

            {accountCreatedNotice && (
                <div className={`mb-6 max-w-2xl text-sm border rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${emailFailedFor ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' : 'text-green-300 bg-green-500/10 border-green-500/30'}`}>
                    <span>{emailFailedFor ? '⚠️' : '✅'} {accountCreatedNotice}</span>
                    {emailFailedFor && (
                        <button
                            onClick={handleResendEmail}
                            disabled={resendingEmail}
                            className="shrink-0 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
                        >
                            {resendingEmail ? 'Reenviando...' : '📩 Reenviar'}
                        </button>
                    )}
                </div>
            )}

            {/* Admins */}
            <div className="mb-8 max-w-2xl">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">🔒 Administradores</h2>

                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input
                        type="email"
                        placeholder="Email del nuevo admin"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                        onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
                    />
                    <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={newAdminName}
                        onChange={e => setNewAdminName(e.target.value)}
                        className="sm:w-44 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                    />
                    <button
                        onClick={handleAddAdmin}
                        disabled={adminSaving}
                        className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
                    >
                        {adminSaving ? 'Guardando…' : '+ Agregar'}
                    </button>
                </div>
                {adminError && <p className="text-red-400 text-sm mb-4">{adminError}</p>}

                {adminsLoading ? (
                    <p className="text-gray-400 text-sm">Cargando…</p>
                ) : admins.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay administradores asignados.</p>
                ) : (
                    <div className="space-y-2">
                        {admins.map(a => (
                            <div key={a.id} className="bg-white/10 border border-white/10 rounded-lg px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1 mr-3">
                                        {editingAdminName === a.email ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={adminNameDraft}
                                                    onChange={e => setAdminNameDraft(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveAdminName(a.email, a.role);
                                                        if (e.key === 'Escape') setEditingAdminName(null);
                                                    }}
                                                    placeholder="Nombre del admin"
                                                    className="flex-1 px-3 py-1 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-400"
                                                />
                                                <button
                                                    onClick={() => handleSaveAdminName(a.email, a.role)}
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
                                                {a.displayName && <p className="text-white font-medium">{a.displayName}</p>}
                                                <p className={a.displayName ? 'text-gray-400 text-sm' : 'text-white font-medium'}>{a.email}</p>
                                            </>
                                        )}
                                    </div>
                                    {editingAdminName !== a.email && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full font-medium">
                                                {a.role === 'organizador' ? 'Organizador' : 'Director de liga'}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setEditingAdminName(a.email);
                                                    setAdminNameDraft(a.displayName || '');
                                                }}
                                                className="p-1 text-gray-500 hover:text-white transition-all"
                                                title="Editar nombre"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleRemoveAdmin(a.email)}
                                                className="px-3 py-1 bg-red-600/30 hover:bg-red-600/60 text-red-300 hover:text-white rounded-lg text-sm transition-all"
                                            >
                                                Quitar rol
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
