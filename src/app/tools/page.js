'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Potrace from 'potrace';
import Navbar from '../components/Navbar';

export default function ToolsPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [optimizedPreview, setOptimizedPreview] = useState(null);
    const [svgOutput, setSvgOutput] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [error, setError] = useState(null);
    const [fileSize, setFileSize] = useState(0);
    const [optimizationInfo, setOptimizationInfo] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            setError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP, BMP, GIF, TIFF)');
            return;
        }

        setError(null);
        setSelectedFile(file);
        setSvgOutput(null);
        setOptimizationInfo(null);
        setIsProcessing(true);
        setProcessingStep('Cargando imagen...');

        // Crear preview original
        const reader = new FileReader();
        reader.onload = async (e) => {
            // Procesar automáticamente: optimizar + eliminar fondo + convertir a SVG
            await processImageAutomatic(e.target.result, file);
        };
        reader.readAsDataURL(file);
    };

    const removeBackground = async (imageDataUrl) => {
        return new Promise((resolve) => {
            const img = new window.Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Detectar color de fondo (esquinas)
                const corners = [
                    { x: 0, y: 0 },
                    { x: canvas.width - 1, y: 0 },
                    { x: 0, y: canvas.height - 1 },
                    { x: canvas.width - 1, y: canvas.height - 1 }
                ];

                let bgR = 0, bgG = 0, bgB = 0;
                corners.forEach(corner => {
                    const i = (corner.y * canvas.width + corner.x) * 4;
                    bgR += data[i];
                    bgG += data[i + 1];
                    bgB += data[i + 2];
                });

                bgR = Math.round(bgR / corners.length);
                bgG = Math.round(bgG / corners.length);
                bgB = Math.round(bgB / corners.length);

                // Eliminar píxeles similares al fondo
                const threshold = 40; // Tolerancia de similitud

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const diffR = Math.abs(r - bgR);
                    const diffG = Math.abs(g - bgG);
                    const diffB = Math.abs(b - bgB);

                    // Si el color es similar al fondo, hacerlo transparente
                    if (diffR < threshold && diffG < threshold && diffB < threshold) {
                        data[i + 3] = 0; // Alpha = 0 (transparente)
                    }
                }

                ctx.putImageData(imageData, 0, 0);

                canvas.toBlob((blob) => {
                    resolve(URL.createObjectURL(blob));
                }, 'image/png');
            };

            img.src = imageDataUrl;
        });
    };

    const processImageAutomatic = async (imageDataUrl, originalFile) => {
        try {
            // Paso 1: Eliminar fondo
            setProcessingStep('Eliminando fondo...');
            const noBgUrl = await removeBackground(imageDataUrl);

            // Paso 2: Optimizar tamaño y calidad
            setProcessingStep('Optimizando imagen...');
            const optimizedUrl = await optimizeImageSmart(noBgUrl, originalFile);

            // Paso 3: Convertir a SVG automáticamente
            setProcessingStep('Convirtiendo a SVG...');
            await convertToSVGAutomatic(optimizedUrl);

        } catch (err) {
            console.error('Error en procesamiento automático:', err);
            setError('Error al procesar la imagen: ' + err.message);
            setIsProcessing(false);
        }
    };

    const optimizeImageSmart = async (imageDataUrl, originalFile) => {
        return new Promise((resolve) => {
            const img = new window.Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                // Ajuste inteligente de tamaño basado en complejidad
                let maxSize = 400; // Tamaño base

                // Si la imagen es muy grande, reducir más
                if (width > 1000 || height > 1000) {
                    maxSize = 300;
                } else if (width < 500 && height < 500) {
                    maxSize = 500; // Permitir más tamaño en imágenes pequeñas
                }

                // Calcular dimensiones manteniendo proporción
                if (width > maxSize || height > maxSize) {
                    const aspectRatio = width / height;

                    if (width > height) {
                        width = maxSize;
                        height = maxSize / aspectRatio;
                    } else {
                        height = maxSize;
                        width = maxSize * aspectRatio;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Aplicar suavizado para mejor calidad
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a blob con compresión
                canvas.toBlob(
                    (blob) => {
                        const optimizedUrl = URL.createObjectURL(blob);
                        setOptimizedPreview(optimizedUrl);

                        const originalSize = originalFile.size;
                        const optimizedSize = blob.size;
                        const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

                        setOptimizationInfo({
                            originalSize: (originalSize / 1024).toFixed(2),
                            optimizedSize: (optimizedSize / 1024).toFixed(2),
                            reduction: reduction,
                            dimensions: `${Math.round(width)}x${Math.round(height)}`,
                            backgroundRemoved: true
                        });

                        resolve(optimizedUrl);
                    },
                    'image/png',
                    0.9 // Alta calidad para mejor resultado
                );
            };

            img.src = imageDataUrl;
        });
    };

    const convertToSVGAutomatic = async (optimizedUrl) => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';

            img.onload = async () => {
                try {
                    // Crear canvas con configuración optimizada
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    let currentWidth = img.width;
                    let currentHeight = img.height;

                    canvas.width = currentWidth;
                    canvas.height = currentHeight;
                    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

                    // Intentar con diferentes configuraciones de Potrace
                    let svg = null;
                    let size = Infinity;
                    let threshold = 128; // Umbral de luminosidad
                    let turdSize = 2; // Tamaño mínimo de características
                    let attempts = 0;
                    const maxAttempts = 15;

                    while (size > 15 * 1024 && attempts < maxAttempts) {
                        try {
                            // Ajustar imagen según intento
                            if (attempts > 5 && currentWidth > 150) {
                                currentWidth = Math.floor(currentWidth * 0.85);
                                currentHeight = Math.floor(currentHeight * 0.85);
                                canvas.width = currentWidth;
                                canvas.height = currentHeight;
                                ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                            }

                            // Obtener datos de imagen
                            const imageData = ctx.getImageData(0, 0, currentWidth, currentHeight);

                            // Usar método simplificado con reducción de colores
                            svg = await convertWithSimplification(imageData, currentWidth, currentHeight, threshold, turdSize);

                            const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
                            size = svgBlob.size;

                            attempts++;

                            // Ajustar parámetros para siguiente intento
                            if (size > 15 * 1024) {
                                threshold += 10; // Hacer más agresivo el threshold
                                turdSize += 2; // Ignorar características más pequeñas

                                if (threshold > 200) {
                                    threshold = 128;
                                    turdSize += 5;
                                }
                            }
                        } catch (err) {
                            console.error('Error en intento de conversión:', err);
                            attempts++;
                        }
                    }

                    setFileSize(size);

                    if (size > 15 * 1024) {
                        setError(`La imagen es muy compleja. Tamaño final: ${(size / 1024).toFixed(2)} KB. Intenta con una imagen más simple.`);
                        setIsProcessing(false);
                        setProcessingStep('');
                        reject(new Error('SVG demasiado grande'));
                    } else {
                        setSvgOutput(svg);
                        setOptimizationInfo(prev => ({
                            ...prev,
                            svgSize: (size / 1024).toFixed(2),
                            finalDimensions: currentWidth !== img.width ? `${currentWidth}x${currentHeight}` : null,
                            attempts
                        }));
                        setIsProcessing(false);
                        setProcessingStep('');
                        resolve(svg);
                    }
                } catch (err) {
                    console.error('Error general en conversión:', err);
                    setError('Error al procesar la imagen: ' + err.message);
                    setIsProcessing(false);
                    setProcessingStep('');
                    reject(err);
                }
            };

            img.onerror = () => {
                setError('Error al cargar la imagen optimizada');
                setIsProcessing(false);
                setProcessingStep('');
                reject(new Error('Error al cargar imagen'));
            };

            img.src = optimizedUrl;
        });
    };

    const getDominantColor = (imageData) => {
        const { data } = imageData;
        const colorMap = new Map();

        // Muestrear colores (cada 5 píxeles para performance)
        for (let i = 0; i < data.length; i += 20) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Ignorar píxeles transparentes o muy claros/oscuros
            if (a < 128 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) continue;

            // Cuantizar color para agrupar similares
            const qr = Math.round(r / 40) * 40;
            const qg = Math.round(g / 40) * 40;
            const qb = Math.round(b / 40) * 40;

            const colorKey = `${qr},${qg},${qb}`;
            colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
        }

        // Encontrar color más frecuente
        let maxCount = 0;
        let dominantColor = '128,128,128';

        colorMap.forEach((count, color) => {
            if (count > maxCount) {
                maxCount = count;
                dominantColor = color;
            }
        });

        const [r, g, b] = dominantColor.split(',').map(Number);
        return `rgb(${r},${g},${b})`;
    };

    const convertWithSimplification = async (imageData, width, height, threshold, turdSize) => {
        return new Promise((resolve, reject) => {
            const { data } = imageData;

            // Detectar color dominante antes de procesar
            const dominantColor = getDominantColor(imageData);

            // Convertir a escala de grises y aplicar threshold
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = width;
            canvas.height = height;

            const processedData = ctx.createImageData(width, height);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // Convertir a escala de grises
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                // Aplicar threshold (blanco o negro)
                const value = gray > threshold ? 255 : 0;

                processedData.data[i] = value;
                processedData.data[i + 1] = value;
                processedData.data[i + 2] = value;
                processedData.data[i + 3] = a < 128 ? 0 : 255; // Mantener transparencia
            }

            ctx.putImageData(processedData, 0, 0);

            // Convertir canvas a buffer para Potrace
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const buffer = Buffer.from(reader.result);

                    Potrace.trace(buffer, {
                        threshold,
                        turdSize,
                        optTolerance: 0.4,
                        color: dominantColor, // Usar color dominante en lugar de negro
                        background: 'transparent'
                    }, (err, svg) => {
                        if (err) {
                            reject(err);
                        } else {
                            // Optimizar SVG eliminando espacios y comentarios
                            const optimizedSvg = svg
                                .replace(/<!--[\s\S]*?-->/g, '') // Eliminar comentarios
                                .replace(/\s+/g, ' ') // Reducir espacios múltiples
                                .replace(/>\s+</g, '><') // Eliminar espacios entre tags
                                .trim();
                            resolve(optimizedSvg);
                        }
                    });
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/png');
        });
    };

    const downloadSVG = () => {
        if (!svgOutput) return;

        const blob = new Blob([svgOutput], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedFile.name.split('.')[0]}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resetTool = () => {
        setSelectedFile(null);
        setOptimizedPreview(null);
        setSvgOutput(null);
        setError(null);
        setFileSize(0);
        setOptimizationInfo(null);
        setIsProcessing(false);
        setProcessingStep('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 overflow-x-hidden">
            {/* Navbar Component */}
            <Navbar />

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-orange-500 to-red-500 text-transparent bg-clip-text">
                            Herramientas IMSA GT7
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300">
                        Herramientas útiles para el equipo IMSA GT7 Racing Club ESP
                    </p>
                </div>

                {/* Image to SVG Converter */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-2xl border border-orange-500/30 mb-8">
                    <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 px-6 py-4">
                        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                            <span>🎨</span> Convertidor de Imagen a SVG
                        </h2>
                    </div>
                    <div className="p-8">
                        <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
                            <p className="text-blue-100">
                                <strong>Proceso Completamente Automático:</strong> Solo sube tu imagen y la herramienta se encarga de:
                                eliminar el fondo, optimizar tamaño y calidad, y convertir a SVG garantizando un peso máximo de 15KB.
                            </p>
                        </div>

                        {/* File Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2 text-orange-300">
                                Seleccionar Imagen (JPG, PNG, WebP, BMP, GIF, TIFF)
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg,image/webp,image/bmp,image/gif,image/tiff"
                                onChange={handleFileSelect}
                                disabled={isProcessing}
                                className="block w-full text-sm text-gray-500 dark:text-gray-400
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-lg file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-gradient-to-r file:from-orange-600 file:to-red-600 file:text-white
                                    hover:file:from-orange-700 hover:file:to-red-700
                                    file:cursor-pointer cursor-pointer
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {isProcessing && (
                                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-blue-700 dark:text-blue-400 font-medium">{processingStep}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Optimization Info */}
                        {optimizationInfo && !isProcessing && (
                            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-400">
                                    ✓ Procesamiento Completado
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Tamaño Original:</p>
                                        <p className="font-semibold">{optimizationInfo.originalSize} KB</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Tamaño Optimizado:</p>
                                        <p className="font-semibold text-green-600 dark:text-green-400">
                                            {optimizationInfo.optimizedSize} KB
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Dimensiones:</p>
                                        <p className="font-semibold">{optimizationInfo.dimensions}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Reducción:</p>
                                        <p className="font-semibold text-green-600 dark:text-green-400">
                                            {optimizationInfo.reduction}%
                                        </p>
                                    </div>
                                    {optimizationInfo.backgroundRemoved && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Fondo:</p>
                                            <p className="font-semibold text-green-600 dark:text-green-400">
                                                ✓ Eliminado
                                            </p>
                                        </div>
                                    )}
                                    {optimizationInfo.colorsUsed && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Colores SVG:</p>
                                            <p className="font-semibold">{optimizationInfo.colorsUsed}</p>
                                        </div>
                                    )}
                                    {optimizationInfo.svgSize && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Tamaño SVG:</p>
                                            <p className="font-semibold text-green-600 dark:text-green-400">
                                                {optimizationInfo.svgSize} KB
                                            </p>
                                        </div>
                                    )}
                                    {optimizationInfo.finalDimensions && optimizationInfo.finalDimensions !== optimizationInfo.dimensions && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Dimensiones Finales:</p>
                                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                {optimizationInfo.finalDimensions}
                                            </p>
                                        </div>
                                    )}
                                    {optimizationInfo.pixelSize && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Simplificación:</p>
                                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                Píxel {optimizationInfo.pixelSize}x
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}                        {/* Preview */}
                        {optimizedPreview && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-3">Vista Previa Optimizada</h3>
                                <div className="relative w-full h-64 bg-gray-100 dark:bg-gt7-dark-800 rounded-lg overflow-hidden">
                                    <Image
                                        src={optimizedPreview}
                                        alt="Preview Optimizado"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg">
                                <p className="text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-4 flex-wrap">
                            {svgOutput && (
                                <>
                                    <button onClick={downloadSVG} className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all duration-200 shadow-lg">
                                        💾 Descargar SVG
                                    </button>
                                    <button onClick={resetTool} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg">
                                        🔄 Nueva Conversión
                                    </button>
                                </>
                            )}
                        </div>

                        {/* SVG Output */}
                        {svgOutput && (
                            <div className="mt-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-semibold">Resultado SVG</h3>
                                    <span className="text-sm px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full">
                                        ✓ {(fileSize / 1024).toFixed(2)} KB
                                    </span>
                                </div>
                                <div className="relative w-full h-64 bg-white dark:bg-gt7-dark-800 rounded-lg overflow-hidden border-2 border-green-500">
                                    <div
                                        className="w-full h-full flex items-center justify-center p-4"
                                        dangerouslySetInnerHTML={{ __html: svgOutput }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-2xl border border-orange-500/30">
                    <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 px-6 py-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span>ℹ️</span> Información
                        </h2>
                    </div>
                    <div className="p-8">
                        <div className="space-y-4 text-gray-300">
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">¿Cómo funciona el proceso automático?</h3>
                                <ol className="list-decimal list-inside space-y-1 ml-4">
                                    <li><strong>Elimina el fondo:</strong> Detecta y elimina automáticamente el fondo de la imagen</li>
                                    <li><strong>Optimiza el tamaño:</strong> Ajusta las dimensiones para un resultado óptimo</li>
                                    <li><strong>Vectoriza con Potrace:</strong> Usa algoritmo profesional de trazado vectorial</li>
                                    <li><strong>Ajusta parámetros:</strong> Optimiza threshold y tolerancia automáticamente</li>
                                    <li><strong>Valida el peso:</strong> Asegura que el archivo sea menor a 15KB</li>
                                </ol>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Consejos para mejores resultados:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Usa imágenes con colores sólidos y bordes definidos</li>
                                    <li>Los logos y gráficos simples funcionan mejor</li>
                                    <li>Imágenes con fondo uniforme facilitan la eliminación automática</li>
                                    <li>El proceso usa Potrace, el mismo algoritmo de herramientas profesionales</li>
                                    <li>Se ajustan automáticamente hasta 15 parámetros diferentes para cumplir el límite</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Tecnología de vectorización:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Usa Potrace: algoritmo profesional de trazado de bitmap a vector</li>
                                    <li>Convierte a escala de grises y aplica umbral inteligente</li>
                                    <li>Optimización progresiva de threshold y tolerancia</li>
                                    <li>Reducción de dimensiones adaptativa cuando es necesario</li>
                                    <li>Minificación automática del SVG resultante</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
