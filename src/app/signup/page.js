"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FirebaseService } from '../services/firebaseService';
import { validateOrgSlug } from '../utils/orgRouting';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

export default function SignupPage() {
    const { currentUser, login, signup, refreshClaims, myOrgIds, loading: authLoading } = useAuth();

    // Si el usuario ya pertenece a una organización (típicamente la suya
    // propia, ya creada antes), no tiene sentido mostrarle el formulario de
    // "crear tu liga" de nuevo — se le manda directo a su panel. Sin esto,
    // cualquiera con una liga ya creada que vuelva a "Crea tu liga" y haga
    // login se quedaba atascado viendo el formulario de alta otra vez.
    useEffect(() => {
        if (!authLoading && currentUser) {
            const existingOrgId = myOrgIds()[0];
            if (existingOrgId) {
                window.location.href = `/l/${existingOrgId}`;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, currentUser]);

    // Paso 1: cuenta
    const [mode, setMode] = useState('signup'); // 'signup' | 'login'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [accountError, setAccountError] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);

    // Paso 2: organización
    const [orgName, setOrgName] = useState('');
    const [orgSlug, setOrgSlug] = useState('');
    const [slugEdited, setSlugEdited] = useState(false);
    const [orgError, setOrgError] = useState('');
    const [orgSaving, setOrgSaving] = useState(false);
    const [created, setCreated] = useState(null);

    const handleOrgNameChange = (value) => {
        setOrgName(value);
        if (!slugEdited) setOrgSlug(slugify(value));
    };

    const handleAccountSubmit = async (e) => {
        e.preventDefault();
        setAccountError('');
        setAccountLoading(true);
        try {
            if (mode === 'signup') {
                await signup(email, password);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setAccountError(err.message || 'Error de autenticación');
        } finally {
            setAccountLoading(false);
        }
    };

    const handleOrgSubmit = async (e) => {
        e.preventDefault();
        setOrgError('');

        const slugCheck = validateOrgSlug(orgSlug);
        if (!slugCheck.valid) {
            setOrgError(slugCheck.error);
            return;
        }
        if (!orgName.trim()) {
            setOrgError('El nombre de la organización es obligatorio');
            return;
        }

        setOrgSaving(true);
        try {
            const result = await FirebaseService.createOrganization(orgName.trim(), orgSlug);
            // create_organization otorga el claim orgs.{slug}='organizador' en
            // el servidor, pero el ID token ya cacheado en el cliente no lo
            // trae — sin este refresh forzado, el panel admin de la org
            // recién creada mostraría "Acceso denegado" hasta el próximo
            // refresh automático del token (hasta 1h).
            await refreshClaims();
            setCreated(result.orgId);
            setTimeout(() => {
                window.location.href = `/l/${result.orgId}`;
            }, 1500);
        } catch (err) {
            setOrgError(err.message || 'Error al crear la organización');
        } finally {
            setOrgSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />

            <div className="max-w-md mx-auto px-4 py-12">
                <div className="text-center mb-8">
                    <div className="text-5xl mb-3">🏆</div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                        Crea tu propia liga en GT7 Championships
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Gratis para probar: 1 campeonato o evento, hasta 15 pilotos.
                    </p>
                </div>

                {authLoading ? (
                    <p className="text-center text-gray-400 text-sm">Cargando…</p>
                ) : currentUser && myOrgIds()[0] ? (
                    <p className="text-center text-gray-400 text-sm">Ya tienes una organización — redirigiendo a tu panel…</p>
                ) : !currentUser ? (
                    <div className="bg-white/10 border border-white/20 rounded-xl p-6">
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setMode('signup')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300'}`}
                            >
                                Crear cuenta
                            </button>
                            <button
                                onClick={() => setMode('login')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300'}`}
                            >
                                Ya tengo cuenta
                            </button>
                        </div>

                        <form onSubmit={handleAccountSubmit} className="space-y-4">
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                            />
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {accountError && <p className="text-red-400 text-sm">{accountError}</p>}
                            <button
                                type="submit"
                                disabled={accountLoading}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 transition-all"
                            >
                                {accountLoading ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
                            </button>
                        </form>
                    </div>
                ) : created ? (
                    <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-6 text-center">
                        <div className="text-4xl mb-3">🎉</div>
                        <p className="text-white font-semibold mb-1">¡Organización creada!</p>
                        <p className="text-gray-300 text-sm">Redirigiendo a trenkit.com/l/{created}…</p>
                    </div>
                ) : (
                    <div className="bg-white/10 border border-white/20 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-6">
                            Sesión iniciada como <span className="text-white">{currentUser.email}</span>. Ahora crea tu organización.
                        </p>
                        <form onSubmit={handleOrgSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre de tu liga</label>
                                <input
                                    type="text"
                                    placeholder="Ej. Hispania Game Team"
                                    value={orgName}
                                    onChange={e => handleOrgNameChange(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">URL de tu liga</label>
                                <input
                                    type="text"
                                    value={orgSlug}
                                    onChange={e => { setOrgSlug(slugify(e.target.value)); setSlugEdited(true); }}
                                    required
                                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-400"
                                />
                                <p className="text-gray-500 text-xs mt-2">trenkit.com/l/{orgSlug || '...'}</p>
                            </div>
                            {orgError && <p className="text-red-400 text-sm">{orgError}</p>}
                            <button
                                type="submit"
                                disabled={orgSaving}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 transition-all"
                            >
                                {orgSaving ? 'Creando…' : 'Crear mi liga'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
}
