"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { FirebaseService } from '../services/firebaseService';

const PLAN_LABELS = { free: 'Free', starter: 'Starter', pro: 'Pro', pro_ia: 'Pro + IA' };
const PLAN_COLORS = {
    free: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    pro: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    pro_ia: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};
const STATUS_COLORS = {
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    canceled: 'bg-red-500/20 text-red-300 border-red-500/30',
    suspended: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function formatDate(ts) {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Formulario inline para otorgar un lote de créditos a una organización —
// venta manual mientras no existe el checkout de Paddle para lotes
// (ADR-007). Aparece al hacer clic en "Otorgar lote" en la fila de la org.
function GrantCreditsForm({ org, onCancel, onGranted }) {
    const [credits, setCredits] = useState(10);
    const [plan, setPlan] = useState(org.plan || 'free');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!credits || credits <= 0) {
            setError('La cantidad debe ser mayor a 0');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const newPlan = plan !== org.plan ? plan : null;
            await FirebaseService.grantChampionshipCredits(org.id, credits, newPlan);
            onGranted();
        } catch (err) {
            console.error('Error otorgando créditos:', err);
            setError('No se pudo otorgar el lote. Intenta de nuevo.');
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2 bg-white/5 border border-white/10 rounded-lg p-2">
            <input
                type="number" min="1" value={credits}
                onChange={e => setCredits(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 bg-white/10 border border-white/30 rounded text-white text-xs"
                placeholder="Cantidad"
            />
            <select
                value={plan} onChange={e => setPlan(e.target.value)}
                className="px-2 py-1 bg-white/10 border border-white/30 rounded text-white text-xs"
            >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="pro_ia">Pro + IA</option>
            </select>
            <button type="submit" disabled={saving}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded">
                {saving ? 'Guardando…' : 'Confirmar'}
            </button>
            <button type="button" onClick={onCancel} disabled={saving}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-medium rounded">
                Cancelar
            </button>
            {error && <span className="text-red-400 text-xs">{error}</span>}
        </form>
    );
}

export default function OrganizacionesAdmin() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [grantingOrgId, setGrantingOrgId] = useState(null);

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    const loadOrgs = () => {
        setLoading(true);
        FirebaseService.getAllOrganizations()
            .then(setOrgs)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!authLoading && currentUser && isPlatformOwner()) {
            loadOrgs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, currentUser]);

    if (authLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la ve el Administrador de Plataforma.</div>;
    }

    const proCount = orgs.filter(o => o.plan === 'pro').length;
    const freeCount = orgs.filter(o => o.plan === 'free').length;

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-1">🏢 Organizaciones</h1>
            <p className="text-gray-400 text-sm mb-8">
                Todas las organizaciones dadas de alta en la plataforma.
            </p>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3 mb-8 max-w-xl">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 text-xs mb-1">Total</div>
                    <div className="text-white font-bold text-xl">{orgs.length}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 text-xs mb-1">Pro</div>
                    <div className="text-orange-300 font-bold text-xl">{proCount}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 text-xs mb-1">Free</div>
                    <div className="text-gray-300 font-bold text-xl">{freeCount}</div>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-500 text-sm">Cargando…</p>
            ) : orgs.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay organizaciones todavía.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-white/10">
                                <th className="py-3 pr-4">Organización</th>
                                <th className="py-3 pr-4">Plan</th>
                                <th className="py-3 pr-4">Estado</th>
                                <th className="py-3 pr-4">Créditos</th>
                                <th className="py-3 pr-4">Organizador</th>
                                <th className="py-3 pr-4">Creada</th>
                                <th className="py-3 pr-4">Límites</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map(org => (
                                <tr key={org.id} className="border-b border-white/5 hover:bg-white/5 align-top">
                                    <td className="py-3 pr-4">
                                        <a
                                            href={`/l/${org.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-white font-semibold hover:text-orange-300 transition-colors"
                                        >
                                            {org.name}
                                        </a>
                                        <div className="text-gray-500 text-xs">/l/{org.slug}</div>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PLAN_COLORS[org.plan] || PLAN_COLORS.free}`}>
                                            {PLAN_LABELS[org.plan] || org.plan || 'Free'}
                                        </span>
                                        {org.billingExempt && (
                                            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                Exenta
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[org.status] || STATUS_COLORS.active}`}>
                                            {org.status || 'active'}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <div className="text-white font-semibold">
                                            {org.billingExempt ? '∞' : (org.championshipCredits ?? 0)}
                                        </div>
                                        <div className="text-gray-500 text-xs">campeonatos/eventos por crear</div>
                                        {grantingOrgId === org.id ? (
                                            <GrantCreditsForm
                                                org={org}
                                                onCancel={() => setGrantingOrgId(null)}
                                                onGranted={() => { setGrantingOrgId(null); loadOrgs(); }}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => setGrantingOrgId(org.id)}
                                                className="mt-1 text-orange-300 hover:text-orange-200 text-xs font-medium underline"
                                            >
                                                + Otorgar lote
                                            </button>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-300">
                                        {org.ownerEmail || '—'}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-400">
                                        {formatDate(org.createdAt)}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-500 text-xs">
                                        {org.limits?.maxDrivers ?? '∞'} pilotos
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
