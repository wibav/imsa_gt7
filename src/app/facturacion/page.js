"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

// Variables públicas (no secretas) de Paddle — ver checklist en
// Notas/Proyectos/GT7 Championships/README.md. El webhook que realmente
// promueve el plan vive en functions/main.py:paddle_webhook, con el
// webhook secret en Secret Manager (nunca aquí).
const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
const PADDLE_PRICE_ID_PRO = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO || '';
const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox';

const PLAN_LABELS = { free: 'Free (prueba única)', starter: 'Starter', pro: 'Pro' };

// Pausa deliberada del checkout mientras se replantean los planes/paquetes
// (integración con Paddle ya probada de punta a punta — checkout, webhook y
// Firestore funcionando; solo se oculta el botón). Volver a `true` cuando
// los precios/planes estén definidos.
const UPGRADE_ENABLED = false;

export default function FacturacionPage() {
    const router = useRouter();
    const { currentUser, isAdmin, currentOrgRole, loading: authLoading } = useAuth();
    const { org, orgId, loading: orgLoading } = useOrganization();

    const [paddleReady, setPaddleReady] = useState(false);
    const [checkoutOpening, setCheckoutOpening] = useState(false);

    const configured = Boolean(PADDLE_CLIENT_TOKEN && PADDLE_PRICE_ID_PRO);

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    useEffect(() => {
        if (!UPGRADE_ENABLED || !configured || typeof window === 'undefined' || window.Paddle) {
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
    }, [configured]);

    const handleUpgrade = useCallback(() => {
        if (!window.Paddle || !orgId || !currentUser) return;
        setCheckoutOpening(true);
        window.Paddle.Checkout.open({
            items: [{ priceId: PADDLE_PRICE_ID_PRO, quantity: 1 }],
            customData: { orgId },
            customer: { email: currentUser.email },
            settings: { successUrl: window.location.href },
        });
        setCheckoutOpening(false);
    }, [orgId, currentUser]);

    if (authLoading || orgLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    if (!currentUser || !isAdmin()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado.</div>;
    }

    const isOrganizador = currentOrgRole() === 'organizador';
    const plan = org?.plan || 'pro';
    const status = org?.status || 'active';
    const limits = org?.limits || {};

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-1">💳 Facturación</h1>
            <p className="text-gray-400 text-sm mb-8">
                Plan y límites de tu organización.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
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
                        <dt className="text-gray-500 text-xs">Campeonatos/eventos activos</dt>
                        <dd className="text-white">{limits.maxActiveChampionshipsOrEvents ?? 'Ilimitado'}</dd>
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
            </div>

            {plan === 'free' && isOrganizador && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <h2 className="text-white font-semibold mb-2">Actualizar a Pro</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Campeonatos/eventos ilimitados, hasta 200 pilotos, branding propio (logo + colores)
                        y URL personalizada.
                    </p>
                    {!UPGRADE_ENABLED ? (
                        <p className="text-gray-500 text-sm italic">
                            Muy pronto. Estamos terminando de definir los planes — vuelve a revisar en unos días.
                        </p>
                    ) : !configured ? (
                        <p className="text-gray-500 text-sm italic">
                            La pasarela de pago todavía no está configurada. Contacta al Administrador de Plataforma.
                        </p>
                    ) : (
                        <button
                            onClick={handleUpgrade}
                            disabled={!paddleReady || checkoutOpening}
                            className="px-5 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 transition-all"
                        >
                            {paddleReady ? '⭐ Actualizar a Pro' : 'Cargando pasarela de pago…'}
                        </button>
                    )}
                </div>
            )}

            {plan === 'free' && !isOrganizador && (
                <p className="text-gray-500 text-sm">
                    Solo el Organizador de esta organización puede actualizar el plan.
                </p>
            )}
        </div>
    );
}
