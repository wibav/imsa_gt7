"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

// Variables públicas (no secretas) de Paddle — ver checklist en
// Notas/Proyectos/GT7 Championships/README.md. El webhook que realmente
// aplica los cambios (plan, límites, créditos) vive en
// functions/main.py:paddle_webhook, con el webhook secret en Secret Manager
// (nunca aquí). Cada price_id debe existir también en el catálogo de
// _PADDLE_PRICE_PLANS / _PADDLE_PRICE_CREDITS del backend — si no coincide,
// el checkout se completa en Paddle pero el webhook no sabe qué desbloquear.
const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox';

const PLAN_LABELS = { free: 'Free (prueba única)', starter: 'Starter', pro: 'Pro', pro_ia: 'Pro + IA' };

// Planes mensuales (suscripción recurrente) — desbloquean límites y
// personalización. 'pro_ia' es el único que además incluye las sugerencias
// de resolución de reclamaciones con IA (tiene coste variable real, ver
// docs/PLAN_MONETIZACION.md §9).
const PLANES = [
    {
        key: 'starter',
        label: 'Starter',
        price: '12 €/mes',
        priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STARTER || '',
        features: ['Hasta 60 pilotos', '2 administradores (incl. owner)', '6 comisarios'],
    },
    {
        key: 'pro',
        label: 'Pro',
        price: '25 €/mes',
        priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO || '',
        features: ['Hasta 200 pilotos', '4 administradores (incl. owner)', '8 comisarios', 'Branding propio (logo + colores)', 'URL personalizada'],
    },
    {
        key: 'pro_ia',
        label: 'Pro + IA',
        price: '35 €/mes',
        priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_IA || '',
        features: ['Hasta 200 pilotos', '4 administradores (incl. owner)', '12 comisarios', 'Branding + URL personalizada', '🤖 Sugerencia de resolución de reclamaciones con IA', 'Hasta 80 sugerencias de IA/mes'],
        highlight: true,
    },
];

// Lotes de créditos (pago único, no caduca) — cuántos campeonatos/eventos
// puede crear la organización. Independiente del plan mensual: una org
// Free puede comprar un lote sin pasar a Starter/Pro.
const LOTES = [
    { key: 'S', credits: 1, price: '4 €', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_LOTE_S || '' },
    { key: 'M', credits: 5, price: '15 €', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_LOTE_M || '' },
    { key: 'L', credits: 10, price: '25 €', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_LOTE_L || '' },
];

const PLAN_RANK = { free: 0, starter: 1, pro: 2, pro_ia: 3 };

export default function FacturacionPage() {
    const router = useRouter();
    const { currentUser, isAdmin, currentOrgRole, loading: authLoading } = useAuth();
    const { org, orgId, loading: orgLoading } = useOrganization();

    const [paddleReady, setPaddleReady] = useState(false);
    const [checkoutKey, setCheckoutKey] = useState(null);

    const paddleConfigured = Boolean(PADDLE_CLIENT_TOKEN);

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    useEffect(() => {
        if (!paddleConfigured || typeof window === 'undefined' || window.Paddle) {
            if (window?.Paddle) setPaddleReady(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.async = true;
        script.onload = () => {
            if (PADDLE_ENV === 'sandbox') window.Paddle.Environment.set('sandbox');
            window.Paddle.Setup({ token: PADDLE_CLIENT_TOKEN });
            setPaddleReady(true);
        };
        document.body.appendChild(script);
        // No se limpia el script al desmontar: Paddle.js es seguro de dejar
        // cargado el resto de la sesión.
    }, [paddleConfigured]);

    const handlePurchase = useCallback((key, priceId) => {
        if (!window.Paddle || !orgId || !currentUser || !priceId) return;
        setCheckoutKey(key);
        window.Paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customData: { orgId },
            customer: { email: currentUser.email },
            settings: { successUrl: window.location.href },
        });
        setCheckoutKey(null);
    }, [orgId, currentUser]);

    if (authLoading || orgLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    if (!currentUser || !isAdmin()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado.</div>;
    }

    const isOrganizador = currentOrgRole() === 'organizador';
    const plan = org?.plan || 'free';
    const status = org?.status || 'active';
    const limits = org?.limits || {};
    const currentRank = PLAN_RANK[plan] ?? 0;

    return (
        <div className="p-6 max-w-3xl">
            <h1 className="text-3xl font-bold text-white mb-1">💳 Facturación</h1>
            <p className="text-gray-400 text-sm mb-8">
                Plan, límites y créditos de tu organización.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-white font-semibold text-lg">{PLAN_LABELS[plan] || plan}</p>
                        <p className="text-gray-400 text-xs">Estado: {status}</p>
                    </div>
                    {plan === 'free' && (
                        <span className="px-3 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full font-medium">
                            Prueba única
                        </span>
                    )}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-gray-500 text-xs">Campeonatos/eventos por crear</dt>
                        <dd className="text-white">{org?.billingExempt ? 'Ilimitado' : (org?.championshipCredits ?? 0)}</dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 text-xs">Pilotos por campeonato</dt>
                        <dd className="text-white">{limits.maxDrivers ?? 'Ilimitado'}</dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 text-xs">Administradores</dt>
                        <dd className="text-white">{limits.maxAdmins ?? 'Ilimitado'}</dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 text-xs">Comisarios</dt>
                        <dd className="text-white">{limits.maxComisarios ?? 'Ilimitado'}</dd>
                    </div>
                </dl>
                {!org?.billingExempt && (org?.championshipCredits ?? 0) <= 0 && (
                    <p className="mt-4 pt-4 border-t border-white/10 text-orange-300 text-sm">
                        Ya usaste todos tus créditos disponibles — necesitas otro lote para crear un nuevo campeonato o evento.
                    </p>
                )}
            </div>

            {!isOrganizador && (
                <p className="text-gray-500 text-sm">
                    Solo el Organizador de esta organización puede comprar lotes o cambiar de plan.
                </p>
            )}

            {isOrganizador && !paddleConfigured && (
                <p className="text-gray-500 text-sm italic mb-8">
                    La pasarela de pago todavía no está configurada. Contacta al Administrador de Plataforma.
                </p>
            )}

            {isOrganizador && paddleConfigured && (
                <>
                    {/* Lotes de créditos — pago único, no caduca, independiente del plan */}
                    <section className="mb-10">
                        <h2 className="text-white font-semibold mb-1">📦 Lotes de créditos</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Cada crédito equivale a un campeonato o evento nuevo. No caducan.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-3">
                            {LOTES.map(lote => (
                                <div key={lote.key} className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
                                    <p className="text-white font-bold text-xl">{lote.credits}</p>
                                    <p className="text-gray-400 text-xs mb-3">campeonatos/eventos</p>
                                    <p className="text-orange-300 font-semibold mb-3">{lote.price}</p>
                                    <button
                                        onClick={() => handlePurchase(`lote-${lote.key}`, lote.priceId)}
                                        disabled={!paddleReady || !lote.priceId || checkoutKey === `lote-${lote.key}`}
                                        className="mt-auto px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all"
                                        title={!lote.priceId ? 'Próximamente' : undefined}
                                    >
                                        {!lote.priceId ? 'Próximamente' : 'Comprar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Planes mensuales — suscripción recurrente, desbloquea límites/branding/IA */}
                    <section>
                        <h2 className="text-white font-semibold mb-1">⭐ Planes mensuales</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Sube de plan para más pilotos, administradores, branding propio y sugerencias con IA.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-3">
                            {PLANES.map(p => {
                                const isCurrent = plan === p.key;
                                const isDowngrade = PLAN_RANK[p.key] < currentRank;
                                return (
                                    <div
                                        key={p.key}
                                        className={`rounded-lg p-4 flex flex-col border ${p.highlight ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10'}`}
                                    >
                                        <p className="text-white font-bold">{p.label}</p>
                                        <p className="text-orange-300 font-semibold mb-2">{p.price}</p>
                                        <ul className="text-gray-400 text-xs space-y-1 mb-3 flex-1">
                                            {p.features.map(f => <li key={f}>• {f}</li>)}
                                        </ul>
                                        <button
                                            onClick={() => handlePurchase(p.key, p.priceId)}
                                            disabled={!paddleReady || !p.priceId || isCurrent || isDowngrade || checkoutKey === p.key}
                                            className="px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 disabled:from-white/10 disabled:to-white/10 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-60"
                                            title={!p.priceId ? 'Próximamente' : (isDowngrade ? 'Contacta al Administrador de Plataforma para bajar de plan' : undefined)}
                                        >
                                            {isCurrent ? 'Plan actual' : (!p.priceId ? 'Próximamente' : (isDowngrade ? 'No disponible' : 'Suscribirse'))}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
