"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { FirebaseService } from '../services/firebaseService';
import { validateImageFile, compressImage } from '../utils/imageCompression';

export default function OrganizacionAdmin() {
    const router = useRouter();
    const { currentUser, currentOrgRole, loading: authLoading } = useAuth();
    const { org, orgId, loading: orgLoading } = useOrganization();

    const [logoUrl, setLogoUrl] = useState('');
    const [colorPrimary, setColorPrimary] = useState('#ea580c'); // orange-600, default actual del sitio
    const [colorSecondary, setColorSecondary] = useState('#dc2626'); // red-600
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    useEffect(() => {
        if (org?.branding) {
            setLogoUrl(org.branding.logoUrl || '');
            setColorPrimary(org.branding.colorPrimary || '#ea580c');
            setColorSecondary(org.branding.colorSecondary || '#dc2626');
        }
    }, [org]);

    if (authLoading || orgLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    const isOrganizador = currentOrgRole() === 'organizador';

    if (!currentUser || !isOrganizador) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Solo el Organizador de una organización puede editar su branding.</div>;
    }

    const handleLogoFile = async (file) => {
        if (!file) return;
        setError('');
        try {
            validateImageFile(file);
            setUploading(true);
            const compressed = await compressImage(file);
            const path = `organizations/${orgId}/branding/logo_${Date.now()}`;
            const url = await FirebaseService.uploadImage(compressed, path);
            setLogoUrl(url);
        } catch (err) {
            setError(err.message || 'No se pudo subir el logo.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            await FirebaseService.updateOrganizationBranding(orgId, {
                logoUrl: logoUrl || null,
                colorPrimary,
                colorSecondary,
            });
            setSaved(true);
        } catch (err) {
            console.error('Error guardando branding:', err);
            setError('No se pudo guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-1">🎨 Mi Organización</h1>
            <p className="text-gray-400 text-sm mb-8">
                Logo y colores propios de <span className="text-white font-semibold">{org?.name}</span> — se aplican
                en la cabecera del sitio cuando alguien visita <code className="text-gray-300">trenkit.com/l/{org?.slug}</code>.
            </p>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Logo</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-black/30 rounded-lg flex items-center justify-center overflow-hidden border border-white/10">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-gray-600 text-xs text-center px-2">Sin logo — se usa el de trenkit por defecto</span>
                            )}
                        </div>
                        <div>
                            <input
                                type="file" accept="image/*"
                                onChange={e => handleLogoFile(e.target.files?.[0])}
                                disabled={uploading}
                                className="text-gray-300 text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-medium hover:file:bg-orange-700 file:cursor-pointer"
                            />
                            {uploading && <p className="text-orange-300 text-xs mt-2">Subiendo…</p>}
                            {logoUrl && !uploading && (
                                <button type="button" onClick={() => setLogoUrl('')} className="text-red-400 hover:text-red-300 text-xs mt-2 underline">
                                    Quitar logo
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Colores de la cabecera</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Color principal</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)}
                                    className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/20" />
                                <span className="text-gray-400 text-xs font-mono">{colorPrimary}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Color secundario</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)}
                                    className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/20" />
                                <span className="text-gray-400 text-xs font-mono">{colorSecondary}</span>
                            </div>
                        </div>
                    </div>
                    <div
                        className="mt-4 h-12 rounded-lg flex items-center px-4 text-white text-sm font-semibold"
                        style={{ background: `linear-gradient(to right, ${colorPrimary}, ${colorSecondary}, ${colorPrimary})` }}
                    >
                        Vista previa de la cabecera
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}
                {saved && <p className="text-green-400 text-sm">✅ Guardado — recarga la página para verlo aplicado.</p>}

                <button
                    type="submit" disabled={saving || uploading}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 transition-all"
                >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </form>
        </div>
    );
}
