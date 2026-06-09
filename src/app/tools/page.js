'use client';

import { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';

const SVG_SIZE_LIMIT_BYTES = 15 * 1024;

const DEFAULT_TRACE_OPTIONS = {
    quantizeColors: 0,
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 2,
};

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return '0.00 KB';
    }

    return `${(bytes / 1024).toFixed(2)} KB`;
}

function stripSvgMarkup(svgText) {
    return svgText
        .replace(/<\?xml[\s\S]*?\?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\r?\n/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function countPaths(svgText) {
    const matches = svgText.match(/<path\b/gi);
    return matches ? matches.length : 0;
}

function createDownloadName(originalName) {
    if (!originalName) {
        return 'gt7-logo.svg';
    }

    return originalName.replace(/\.[^.]+$/, '') + '.svg';
}

function resolveConverterUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_GT7_CONVERT_FUNCTION_URL;
    if (configuredUrl) {
        return configuredUrl;
    }

    if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        if (projectId) {
            return `https://us-central1-${projectId}.cloudfunctions.net/convert_to_gt_svg`;
        }
    }

    return '/api/convert_to_gt_svg';
}

function downloadSvg(svgText, originalName) {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = createDownloadName(originalName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function RangeField({ label, value, min, max, step = 1, suffix = '', helper, onChange }) {
    return (
        <label className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-inner shadow-black/20">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-100">
                <span>{label}</span>
                <span className="text-orange-300">{value}{suffix}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="mt-3 w-full accent-orange-500"
            />
            <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
        </label>
    );
}

function StatCard({ label, value, helper, tone = 'text-orange-300' }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-slate-400">{label}</p>
            <p className={`mt-2 text-lg font-bold ${tone}`}>{value}</p>
            {helper ? <p className="mt-1 text-xs leading-5 text-slate-400">{helper}</p> : null}
        </div>
    );
}

export default function ToolsPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [svgOutput, setSvgOutput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [conversionInfo, setConversionInfo] = useState(null);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [traceOptions, setTraceOptions] = useState(DEFAULT_TRACE_OPTIONS);
    const fileInputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const updateTraceOption = (key) => (value) => {
        setTraceOptions((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const resetTool = () => {
        setSelectedFile(null);
        setPreviewUrl('');
        setSvgOutput('');
        setIsProcessing(false);
        setProcessingStep('');
        setError('');
        setWarning('');
        setFileSize(0);
        setConversionInfo(null);
        setAdvancedMode(false);
        setIsDragging(false);
        setTraceOptions(DEFAULT_TRACE_OPTIONS);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const convertFile = async (file) => {
        if (!file) {
            return;
        }

        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (!isPng) {
            setError('Solo se admiten archivos PNG.');
            setWarning('');
            return;
        }

        setSelectedFile(file);
        setError('');
        setWarning('');
        setSvgOutput('');
        setConversionInfo(null);
        setFileSize(0);
        setIsProcessing(true);
        setProcessingStep('Preparando PNG...');

        const nextPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(nextPreviewUrl);

        const formData = new FormData();
        formData.append('file', file, file.name);

        Object.entries(traceOptions).forEach(([key, value]) => {
            formData.append(key, String(value));
        });

        const startedAt = performance.now();

        try {
            setProcessingStep('Enviando a Firebase Function...');

            const response = await fetch(resolveConverterUrl(), {
                method: 'POST',
                body: formData,
            });

            const bodyText = await response.text();
            let payload = null;

            if ((response.headers.get('content-type') || '').includes('application/json')) {
                try {
                    payload = JSON.parse(bodyText);
                } catch {
                    payload = null;
                }
            }

            if (!response.ok) {
                throw new Error(payload?.message || payload?.error || bodyText || 'No se pudo convertir la imagen.');
            }

            const rawSvg = typeof payload?.svg === 'string' ? payload.svg : bodyText;
            const svgText = stripSvgMarkup(rawSvg);

            if (!svgText) {
                throw new Error('La Function devolvió un SVG vacío.');
            }

            const svgBytes = new Blob([svgText], { type: 'image/svg+xml' }).size;
            const pathCount = countPaths(svgText);
            const elapsedMs = Math.round(performance.now() - startedAt);
            const underLimit = svgBytes <= SVG_SIZE_LIMIT_BYTES;

            setSvgOutput(svgText);
            setFileSize(svgBytes);
            setConversionInfo({
                originalSize: formatBytes(file.size),
                svgSize: formatBytes(svgBytes),
                pathCount,
                elapsedMs,
                pathPrecisionUsed: payload?.pathPrecisionUsed ?? traceOptions.pathPrecision,
                dimensions: payload?.width && payload?.height ? `${payload.width}x${payload.height}` : null,
                underLimit,
            });

            const backendWarning = typeof payload?.warning === 'string' ? payload.warning : '';
            setWarning(
                backendWarning || (underLimit ? '' : `El SVG generado pesa ${formatBytes(svgBytes)} y supera el límite de 15 KB de GT7.`)
            );

            downloadSvg(svgText, file.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo convertir la imagen.');
            setWarning('');
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const handleInputChange = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            void convertFile(file);
        }

        event.target.value = '';
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);

        const file = event.dataTransfer.files?.[0];
        if (file) {
            void convertFile(file);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        setIsDragging(false);
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,_#081221_0%,_#050816_55%,_#0f172a_100%)]" />
            <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="absolute right-0 top-[28rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

            <Navbar />

            <main className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:px-8 lg:py-12">
                <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
                            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                                <span className="block">PNG a SVG</span>
                                <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-amber-300 bg-clip-text text-transparent">
                                    sin salir de la página
                                </span>
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                                Sube un PNG y obtendrás un SVG limpio y optimizado listo para usar en GT7, en segundos.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-300">15 KB objetivo</span>
                                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-300">Descarga automática</span>
                                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-slate-300">Optimizado para GT7</span>
                            </div>

                            <div
                                className={`mt-8 rounded-[1.75rem] border border-dashed p-5 transition-all ${isDragging
                                    ? 'border-orange-300 bg-orange-500/10'
                                    : 'border-white/15 bg-slate-950/40'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png"
                                    onChange={handleInputChange}
                                    disabled={isProcessing}
                                    className="hidden"
                                />

                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-2xl shadow-lg shadow-orange-500/30">
                                        ↑
                                    </div>

                                    <div className="flex-1">
                                        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-orange-200/80">Carga directa</p>
                                        <h2 className="mt-2 text-2xl font-bold text-white">Suelta un PNG o elige un archivo</h2>
                                        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                                            El archivo se procesa automáticamente y el SVG se descarga en cuanto está listo.
                                        </p>

                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                                className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Elegir PNG
                                            </button>
                                            <button
                                                type="button"
                                                onClick={resetTool}
                                                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                                            >
                                                Limpiar
                                            </button>
                                        </div>

                                        {selectedFile && (
                                            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                                <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-orange-100">
                                                    {selectedFile.name}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-300">
                                                    {formatBytes(selectedFile.size)}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-300">
                                                    {selectedFile.type || 'image/png'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isProcessing && (
                                    <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3">
                                        <div className="flex items-center gap-3 text-sm text-blue-100">
                                            <svg className="h-5 w-5 animate-spin text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path
                                                    className="opacity-90"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span className="font-medium">{processingStep}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {warning && (
                                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                                    {warning}
                                </div>
                            )}

                            {error && (
                                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5">
                                <button
                                    type="button"
                                    onClick={() => setAdvancedMode((current) => !current)}
                                    className="flex w-full items-center justify-between gap-4 text-left"
                                >
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Ajustes finos</p>
                                        <h3 className="mt-2 text-lg font-semibold text-white">VTracer compacto para GT7</h3>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                                        {advancedMode ? 'Ocultar' : 'Mostrar'}
                                    </span>
                                </button>

                                {!advancedMode ? (
                                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">spline</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">path precision {traceOptions.pathPrecision}</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">filter speckle {traceOptions.filterSpeckle}</span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">color precision {traceOptions.colorPrecision}</span>
                                    </div>
                                ) : (
                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                        <RangeField
                                            label="Colores (cuantización)"
                                            value={traceOptions.quantizeColors}
                                            min={0}
                                            max={12}
                                            step={1}
                                            suffix={traceOptions.quantizeColors === 0 ? ' (auto)' : ' colores'}
                                            helper="0 = automático. Para logos con textura/foto de fondo, fija 4-8 colores planos: conserva resolución (no baja a 128px) y mejora la nitidez en GT7."
                                            onChange={updateTraceOption('quantizeColors')}
                                        />
                                        <RangeField
                                            label="Path precision"
                                            value={traceOptions.pathPrecision}
                                            min={1}
                                            max={4}
                                            step={1}
                                            helper="Más bajo = SVG más pequeño. 2 suele ser el mejor equilibrio."
                                            onChange={updateTraceOption('pathPrecision')}
                                        />
                                        <RangeField
                                            label="Filter speckle"
                                            value={traceOptions.filterSpeckle}
                                            min={0}
                                            max={16}
                                            step={1}
                                            helper="Elimina ruido microscópico antes de vectorizar."
                                            onChange={updateTraceOption('filterSpeckle')}
                                        />
                                        <RangeField
                                            label="Color precision"
                                            value={traceOptions.colorPrecision}
                                            min={4}
                                            max={8}
                                            step={1}
                                            helper="Menos bits = SVG más compacto, más bits = más fidelidad."
                                            onChange={updateTraceOption('colorPrecision')}
                                        />
                                        <RangeField
                                            label="Layer difference"
                                            value={traceOptions.layerDifference}
                                            min={0}
                                            max={32}
                                            step={1}
                                            helper="Ajusta cuánto se separan las capas de color."
                                            onChange={updateTraceOption('layerDifference')}
                                        />
                                        <RangeField
                                            label="Corner threshold"
                                            value={traceOptions.cornerThreshold}
                                            min={20}
                                            max={120}
                                            step={1}
                                            helper="Ángulos más altos suavizan esquinas muy marcadas."
                                            onChange={updateTraceOption('cornerThreshold')}
                                        />
                                        <RangeField
                                            label="Length threshold"
                                            value={traceOptions.lengthThreshold}
                                            min={2}
                                            max={8}
                                            step={0.5}
                                            helper="Rango compacto para logos: 3.5 a 5.5 suele funcionar bien."
                                            onChange={updateTraceOption('lengthThreshold')}
                                        />
                                        <RangeField
                                            label="Max iterations"
                                            value={traceOptions.maxIterations}
                                            min={4}
                                            max={14}
                                            step={1}
                                            helper="Más iteraciones mejora curvas pero puede agrandar el archivo."
                                            onChange={updateTraceOption('maxIterations')}
                                        />
                                        <RangeField
                                            label="Splice threshold"
                                            value={traceOptions.spliceThreshold}
                                            min={20}
                                            max={90}
                                            step={1}
                                            helper="Más alto = curvas más suaves y menos detalle fino."
                                            onChange={updateTraceOption('spliceThreshold')}
                                        />
                                    </div>
                                )}

                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={() => void convertFile(selectedFile)}
                                        disabled={isProcessing}
                                        className="mt-5 w-full rounded-xl border border-orange-400/30 bg-orange-500/15 px-5 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        🔁 Reconvertir con estos ajustes
                                    </button>
                                )}
                            </div>

                            {conversionInfo && !isProcessing && (
                                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <StatCard label="Tamaño original" value={conversionInfo.originalSize} helper="PNG subido al servidor." />
                                    <StatCard
                                        label="SVG final"
                                        value={conversionInfo.svgSize}
                                        helper={conversionInfo.underLimit ? 'Dentro del límite de GT7.' : 'Requiere revisar ajustes.'}
                                        tone={conversionInfo.underLimit ? 'text-emerald-300' : 'text-amber-300'}
                                    />
                                    <StatCard label="Paths" value={conversionInfo.pathCount} helper="Cantidad de rutas trazadas." />
                                    <StatCard label="Tiempo" value={`${conversionInfo.elapsedMs} ms`} helper="Tiempo total de conversión." />
                                </div>
                            )}
                        </div>

                        <div className="space-y-6 p-6 sm:p-8 lg:p-10">
                            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-5 shadow-inner shadow-black/20">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">Vista previa</p>
                                        <h3 className="mt-1 text-xl font-semibold text-white">PNG original</h3>
                                    </div>
                                    {selectedFile && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                            {formatBytes(selectedFile.size)}
                                        </span>
                                    )}
                                </div>

                                <div
                                    className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(45deg,rgba(148,163,184,0.12)_25%,transparent_25%,transparent_50%,rgba(148,163,184,0.12)_50%,rgba(148,163,184,0.12)_75%,transparent_75%,transparent)] bg-[length:24px_24px]"
                                    style={{ minHeight: '20rem' }}
                                >
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt={selectedFile ? `Vista previa de ${selectedFile.name}` : 'Vista previa PNG'}
                                            className="h-full w-full object-contain p-4"
                                        />
                                    ) : (
                                        <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                                            <div className="text-4xl">🖼️</div>
                                            <p className="mt-4 text-sm font-medium text-slate-200">Tu PNG aparecerá aquí</p>
                                            <p className="mt-2 max-w-xs text-xs leading-6 text-slate-400">
                                                La vista previa ayuda a comprobar que la transparencia y el encuadre estén correctos antes de descargar el SVG.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-5 shadow-inner shadow-black/20">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">Salida</p>
                                        <h3 className="mt-1 text-xl font-semibold text-white">SVG generado</h3>
                                    </div>

                                    {svgOutput && (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span
                                                className={`rounded-full border px-3 py-1 ${conversionInfo?.underLimit
                                                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                                                    : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                                                    }`}
                                            >
                                                {fileSize ? formatBytes(fileSize) : '0.00 KB'}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                                                {conversionInfo?.pathCount ?? 0} paths
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div
                                    className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(45deg,rgba(148,163,184,0.12)_25%,transparent_25%,transparent_50%,rgba(148,163,184,0.12)_50%,rgba(148,163,184,0.12)_75%,transparent_75%,transparent)] bg-[length:24px_24px]"
                                    style={{ minHeight: '20rem' }}
                                >
                                    {svgOutput ? (
                                        <div className="max-h-[30rem] overflow-auto p-4" dangerouslySetInnerHTML={{ __html: svgOutput }} />
                                    ) : (
                                        <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                                            <div className="text-4xl">✨</div>
                                            <p className="mt-4 text-sm font-medium text-slate-200">SVG listo para GT7</p>
                                            <p className="mt-2 max-w-xs text-xs leading-6 text-slate-400">
                                                Cuando Firebase termine, aquí verás el SVG compacto y la descarga comenzará automáticamente.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => svgOutput && downloadSvg(svgOutput, selectedFile?.name)}
                                        disabled={!svgOutput || isProcessing}
                                        className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Descargar otra vez
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetTool}
                                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        Nueva conversión
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


            </main>
        </div>
    );
}