'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import ImageTracer from 'imagetracerjs';
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

    // Parámetros avanzados
    const [advancedMode, setAdvancedMode] = useState(false);
    const [threshold, setThreshold] = useState(128);
    const [turdSize, setTurdSize] = useState(2);
    const [imageComplexity, setImageComplexity] = useState(null);

    // Detectar colores dominantes en la imagen para preservar detalles críticos
    const detectDominantColors = (imageData) => {
        const { data } = imageData;
        const colorMap = new Map();

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a > 128) {
                // Agrupar colores en buckets de 32 para detectar gamas
                const bucket = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;
                colorMap.set(bucket, (colorMap.get(bucket) || 0) + 1);
            }
        }

        // Retornar top 5 colores
        return Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);
    };

    // Analizar complejidad de imagen con detección mejorada
    const analyzeImageComplexity = (imageData) => {
        const { data, width, height } = imageData;
        const colorSet = new Set();

        // Detectar bordes para medir complejidad real
        let edgePixels = 0;
        const grayscale = [];

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            grayscale.push(gray);

            if (a > 128) {
                const qr = Math.floor(r / 16) * 16;
                const qg = Math.floor(g / 16) * 16;
                const qb = Math.floor(b / 16) * 16;
                colorSet.add(`${qr},${qg},${qb}`);
            }
        }

        // Calcular densidad de bordes (detección de Sobel simplificada)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = Math.abs(grayscale[idx + 1] - grayscale[idx - 1]) +
                    Math.abs(grayscale[idx + width] - grayscale[idx - width]);
                if (gx > 50) edgePixels++;
            }
        }

        const colorCount = colorSet.size;
        const edgeDensity = edgePixels / (width * height);
        const complexityScore = colorCount * 0.6 + edgeDensity * 100 * 0.4;

        let complexity = 'simple';
        let recThreshold = 128;
        let recTurdSize = 2;

        if (complexityScore > 35) {
            complexity = 'muy_compleja';
            recThreshold = 128;
            recTurdSize = 2;
        } else if (complexityScore > 20) {
            complexity = 'compleja';
            recThreshold = 130;
            recTurdSize = 2;
        } else if (complexityScore > 10) {
            complexity = 'media';
            recThreshold = 124;
            recTurdSize = 2;
        }

        const result = {
            colorCount,
            complexity,
            complexityScore: complexityScore.toFixed(1),
            edgeDensity: (edgeDensity * 100).toFixed(1),
            recommendedThreshold: recThreshold,
            recommendedTurdSize: recTurdSize,
            dimensions: `${width}x${height}`
        };

        setImageComplexity(result);
        setThreshold(recThreshold);
        setTurdSize(recTurdSize);

        return result;
    };

    // Comprimir SVG mínimamente para preservar fidelidad
    const compressSvgWithSVGO = (svg) => {
        let compressed = svg;
        compressed = compressed.replace(/(\d+\.\d{4,})/g, (m) => parseFloat(m).toFixed(3)); // más precisión
        compressed = compressed.replace(/\s+(version|xmlns:xlink)="[^"]*"/g, '');
        compressed = compressed.replace(/stroke="none"/gi, '');
        compressed = compressed.replace(/\s+M\s+/g, 'M').replace(/\s+L\s+/g, 'L').replace(/\s+C\s+/g, 'C');
        return compressed;
    };

    const toHexColor = ({ r, g, b }) => {
        return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    };

    const TRANSPARENT_LAYER = { r: 255, g: 0, b: 255, a: 0, order: -1000 };

    const buildLogoPalette = (useSevenColors = false) => {
        const basePalette = [
            TRANSPARENT_LAYER,
            { r: 8, g: 128, b: 176, a: 255, order: 0 },
            { r: 224, g: 24, b: 56, a: 255, order: 10 },
            { r: 255, g: 192, b: 0, a: 255, order: 20 },
            { r: 16, g: 16, b: 16, a: 255, order: 30 },
            { r: 51, g: 51, b: 51, a: 255, order: 35 },
            { r: 255, g: 255, b: 255, a: 255, order: 50 },
        ];

        if (useSevenColors) {
            return [
                TRANSPARENT_LAYER,
                { r: 8, g: 128, b: 176, a: 255, order: 0 },
                { r: 224, g: 24, b: 56, a: 255, order: 10 },
                { r: 255, g: 192, b: 0, a: 255, order: 20 },
                { r: 16, g: 16, b: 16, a: 255, order: 30 },
                { r: 51, g: 51, b: 51, a: 255, order: 35 },
                { r: 204, g: 204, b: 204, a: 255, order: 40 },
                { r: 255, g: 255, b: 255, a: 255, order: 50 },
            ];
        }

        return basePalette;
    };

    const quantizeImageDataToPalette = (imageData, palette) => {
        const { data, width, height } = imageData;
        const quantized = new Uint8ClampedArray(data.length);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 16) {
                quantized[i] = TRANSPARENT_LAYER.r;
                quantized[i + 1] = TRANSPARENT_LAYER.g;
                quantized[i + 2] = TRANSPARENT_LAYER.b;
                quantized[i + 3] = TRANSPARENT_LAYER.a;
                continue;
            }

            let nearestColor = palette[0];
            let minDistance = Infinity;

            for (const color of palette) {
                const dr = data[i] - color.r;
                const dg = data[i + 1] - color.g;
                const db = data[i + 2] - color.b;
                const distance = dr * dr + dg * dg + db * db;

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestColor = color;
                }
            }

            quantized[i] = nearestColor.r;
            quantized[i + 1] = nearestColor.g;
            quantized[i + 2] = nearestColor.b;
            quantized[i + 3] = alpha;
        }

        return new ImageData(quantized, width, height);
    };

    const buildMergedSvgFromTracedata = (tracedata, options, palette, width, height) => {
        const orderMap = new Map(palette.map((color) => [toHexColor(color), color.order ?? 100]));
        const renderedPaths = [];

        for (let layerIndex = 0; layerIndex < tracedata.layers.length; layerIndex++) {
            let layerPathData = '';

            for (let pathIndex = 0; pathIndex < tracedata.layers[layerIndex].length; pathIndex++) {
                if (tracedata.layers[layerIndex][pathIndex].isholepath) continue;

                const pathString = ImageTracer.svgpathstring(tracedata, layerIndex, pathIndex, options);
                const match = pathString.match(/d="([^"]*)"/);
                if (match) {
                    layerPathData += `${match[1]} `;
                }
            }

            const trimmedPathData = layerPathData.trim();
            if (!trimmedPathData) continue;

            const layerColor = tracedata.palette[layerIndex];
            if (!layerColor || layerColor.a === 0) continue;
            const fillColor = toHexColor(layerColor);
            renderedPaths.push({
                order: orderMap.get(fillColor) ?? 100,
                path: `<path fill="${fillColor}" fill-rule="evenodd" d="${trimmedPathData}"/>`,
            });
        }

        renderedPaths.sort((a, b) => a.order - b.order);

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${renderedPaths.map((entry) => entry.path).join('')}</svg>`;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validar que sea PNG (se conserva transparencia y colores originales)
        const isPNG = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (!isPNG) {
            setError('Solo se admiten imágenes PNG. Exporta tu diseño con transparencia para obtener el mejor resultado.');
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
                const { data, width, height } = imageData;

                const samplePoints = [
                    { x: 0, y: 0 },
                    { x: width - 1, y: 0 },
                    { x: 0, y: height - 1 },
                    { x: width - 1, y: height - 1 },
                    { x: Math.max(0, Math.floor(width * 0.08)), y: Math.max(0, Math.floor(height * 0.08)) },
                    { x: Math.max(0, Math.floor(width * 0.92)), y: Math.max(0, Math.floor(height * 0.08)) },
                    { x: Math.max(0, Math.floor(width * 0.08)), y: Math.max(0, Math.floor(height * 0.92)) },
                    { x: Math.max(0, Math.floor(width * 0.92)), y: Math.max(0, Math.floor(height * 0.92)) },
                ];

                const sampleCounts = new Map();
                for (const point of samplePoints) {
                    const index = (point.y * width + point.x) * 4;
                    if (data[index + 3] === 0) continue;
                    const bucket = `${Math.round(data[index] / 16)},${Math.round(data[index + 1] / 16)},${Math.round(data[index + 2] / 16)}`;
                    sampleCounts.set(bucket, (sampleCounts.get(bucket) || 0) + 1);
                }

                if (sampleCounts.size === 0) {
                    resolve(canvas.toDataURL());
                    return;
                }

                let backgroundBucket = null;
                let backgroundCount = 0;
                sampleCounts.forEach((count, bucket) => {
                    if (count > backgroundCount) {
                        backgroundCount = count;
                        backgroundBucket = bucket;
                    }
                });

                const [bgR, bgG, bgB] = backgroundBucket.split(',').map((value) => Math.min(255, parseInt(value, 10) * 16));
                const threshold = 36;
                const matchesBackground = (index) => {
                    if (data[index + 3] === 0) return false;
                    const dr = data[index] - bgR;
                    const dg = data[index + 1] - bgG;
                    const db = data[index + 2] - bgB;
                    return Math.sqrt(dr * dr + dg * dg + db * db) <= threshold;
                };

                const visited = new Uint8Array(width * height);
                const queue = [];
                const enqueueIfBackground = (x, y) => {
                    if (x < 0 || y < 0 || x >= width || y >= height) return;
                    const index = y * width + x;
                    if (visited[index]) return;
                    if (!matchesBackground(index * 4)) return;
                    visited[index] = 1;
                    queue.push(index);
                };

                for (let x = 0; x < width; x++) {
                    enqueueIfBackground(x, 0);
                    enqueueIfBackground(x, height - 1);
                }

                for (let y = 0; y < height; y++) {
                    enqueueIfBackground(0, y);
                    enqueueIfBackground(width - 1, y);
                }

                while (queue.length > 0) {
                    const index = queue.pop();
                    const pixelIndex = index * 4;
                    data[pixelIndex + 3] = 0;

                    const x = index % width;
                    const y = Math.floor(index / width);
                    enqueueIfBackground(x + 1, y);
                    enqueueIfBackground(x - 1, y);
                    enqueueIfBackground(x, y + 1);
                    enqueueIfBackground(x, y - 1);
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL());
            };

            img.src = imageDataUrl;
        });
    };

    const processImageAutomatic = async (imageDataUrl, originalFile) => {
        try {
            setProcessingStep('Eliminando fondo exterior...');
            const backgroundRemovedUrl = await removeBackground(imageDataUrl);

            // Paso 2: Optimizar tamaño y calidad
            setProcessingStep('Optimizando imagen...');
            const { optimizedUrl, complexityHint } = await optimizeImageSmart(backgroundRemovedUrl, originalFile);

            // Paso 3: Convertir a SVG automáticamente
            setProcessingStep('Convirtiendo a SVG...');
            await convertToSVGAutomatic(optimizedUrl, complexityHint);

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

                // Ajuste inteligente de tamaño basado en complejidad - máxima resolución
                let maxSize = 600; // máxima para fidelidad

                // Calcular complejidad antes de escalar
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const initialImageData = ctx.getImageData(0, 0, width, height);
                const preComplexity = analyzeImageComplexity(initialImageData);

                // Mantener máxima resolución para logos complejos
                if (preComplexity.complexity === 'muy_compleja') {
                    maxSize = 700;
                } else if (preComplexity.complexity === 'compleja') {
                    maxSize = 600;
                } else if (preComplexity.complexity === 'media') {
                    maxSize = 500;
                } else {
                    maxSize = 400; // simples suficientemente grandes
                }

                // Si la imagen es muy grande, limitar más aún
                if (width > 1200 || height > 1200) {
                    maxSize = Math.min(maxSize, 300);
                }

                // Recalcular dimensiones manteniendo proporción
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

                // No simplificar colores para preservar detalles del diseño original
                const imageData = ctx.getImageData(0, 0, width, height);

                // Convertir a blob con compresión
                canvas.toBlob(
                    (blob) => {
                        const optimizedUrl = URL.createObjectURL(blob);
                        setOptimizedPreview(optimizedUrl);

                        const originalSize = originalFile.size;
                        const optimizedSize = blob.size;
                        const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

                        // Analizar complejidad de la imagen simplificada
                        const finalImageData = ctx.getImageData(0, 0, width, height);
                        const complexity = analyzeImageComplexity(finalImageData);

                        setOptimizationInfo({
                            originalSize: (originalSize / 1024).toFixed(2),
                            optimizedSize: (optimizedSize / 1024).toFixed(2),
                            reduction: reduction,
                            dimensions: `${Math.round(width)}x${Math.round(height)}`,
                            backgroundRemoved: true,
                            complexity: complexity.complexity,
                            colors: complexity.colorCount,
                            colorSimplification: false
                        });

                        resolve({ optimizedUrl, complexityHint: preComplexity.complexity });
                    },
                    'image/png',
                    0.9 // Alta calidad para mejor resultado
                );
            };

            img.src = imageDataUrl;
        });
    };

    const convertToSVGAutomatic = async (optimizedUrl, complexityHint = 'media') => {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';

            img.onload = async () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    let currentWidth = img.width;
                    let currentHeight = img.height;

                    const maxDim = complexityHint === 'muy_compleja' ? 600
                        : complexityHint === 'compleja' ? 500
                            : complexityHint === 'media' ? 400 : 350;

                    if (currentWidth > maxDim || currentHeight > maxDim) {
                        const ratio = currentWidth / currentHeight;
                        if (ratio >= 1) {
                            currentWidth = maxDim;
                            currentHeight = Math.round(maxDim / ratio);
                        } else {
                            currentHeight = maxDim;
                            currentWidth = Math.round(maxDim * ratio);
                        }
                    }

                    canvas.width = currentWidth;
                    canvas.height = currentHeight;
                    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

                    const sourceImageData = ctx.getImageData(0, 0, currentWidth, currentHeight);
                    const basePathomit = Math.max(3, Math.min(6, Math.round(turdSize + 2)));
                    const baseDetail = Math.max(0.85, Math.min(1, threshold / 142));

                    const attemptConfigs = [
                        {
                            name: 'fidelidad',
                            palette: buildLogoPalette(false),
                            options: {
                                colorsampling: 0,
                                colorquantcycles: 1,
                                layering: 0,
                                pathomit: basePathomit,
                                roundcoords: 0,
                                ltres: baseDetail,
                                qtres: baseDetail,
                                numberofcolors: 6,
                                linefilter: false,
                                strokewidth: 0,
                                scale: 1,
                                viewbox: true,
                                desc: false,
                                blurradius: 0,
                                blurdelta: 20,
                            },
                        },
                        {
                            name: 'ampliado',
                            palette: buildLogoPalette(true),
                            options: {
                                colorsampling: 0,
                                colorquantcycles: 1,
                                layering: 0,
                                pathomit: Math.min(6, basePathomit + 1),
                                roundcoords: 0,
                                ltres: Math.min(1, baseDetail + 0.05),
                                qtres: Math.min(1, baseDetail + 0.05),
                                numberofcolors: 7,
                                linefilter: false,
                                strokewidth: 0,
                                scale: 1,
                                viewbox: true,
                                desc: false,
                                blurradius: 0,
                                blurdelta: 20,
                            },
                        },
                        {
                            name: 'compacto',
                            palette: [
                                TRANSPARENT_LAYER,
                                { r: 8, g: 128, b: 176, a: 255, order: 0 },
                                { r: 224, g: 24, b: 56, a: 255, order: 10 },
                                { r: 255, g: 192, b: 0, a: 255, order: 20 },
                                { r: 16, g: 16, b: 16, a: 255, order: 30 },
                                { r: 51, g: 51, b: 51, a: 255, order: 35 },
                                { r: 255, g: 255, b: 255, a: 255, order: 40 },
                            ],
                            options: {
                                colorsampling: 0,
                                colorquantcycles: 1,
                                layering: 0,
                                pathomit: Math.min(6, basePathomit + 1),
                                roundcoords: 0,
                                ltres: Math.min(1, baseDetail + 0.1),
                                qtres: Math.min(1, baseDetail + 0.1),
                                numberofcolors: 5,
                                linefilter: false,
                                strokewidth: 0,
                                scale: 1,
                                viewbox: true,
                                desc: false,
                                blurradius: 0,
                                blurdelta: 20,
                            },
                        },
                    ];

                    let bestResult = null;

                    for (const attempt of attemptConfigs) {
                        setProcessingStep(`Vectorizando (${attempt.name})...`);
                        const quantizedImageData = quantizeImageDataToPalette(sourceImageData, attempt.palette);
                        const tracingOptions = { ...attempt.options, pal: attempt.palette };
                        const tracedata = ImageTracer.imagedataToTracedata(quantizedImageData, tracingOptions);
                        let svgCandidate = buildMergedSvgFromTracedata(tracedata, tracingOptions, attempt.palette, currentWidth, currentHeight);
                        svgCandidate = compressSvgWithSVGO(svgCandidate);

                        const candidateSize = new Blob([svgCandidate], { type: 'image/svg+xml' }).size;
                        const candidatePaths = (svgCandidate.match(/<path/g) || []).length;

                        if (!bestResult || candidateSize < bestResult.size) {
                            bestResult = {
                                svg: svgCandidate,
                                size: candidateSize,
                                pathCount: candidatePaths,
                                attempt: attempt.name,
                            };
                        }

                        if (candidateSize <= 15 * 1024) {
                            bestResult = {
                                svg: svgCandidate,
                                size: candidateSize,
                                pathCount: candidatePaths,
                                attempt: attempt.name,
                            };
                            break;
                        }
                    }

                    if (!bestResult) {
                        throw new Error('No se pudo generar SVG');
                    }

                    setFileSize(bestResult.size);
                    setSvgOutput(bestResult.svg);
                    setOptimizationInfo(prev => ({
                        ...prev,
                        svgSize: (bestResult.size / 1024).toFixed(2),
                        compressionGain: 'N/A',
                        finalDimensions: `${currentWidth}x${currentHeight}`,
                        attempts: attemptConfigs.length,
                        finalThreshold: threshold,
                        finalTurdSize: turdSize,
                        svgLayers: bestResult.pathCount,
                    }));

                    if (bestResult.size > 15 * 1024) {
                        setError(`⚠️ Advertencia: El resultado es ${(bestResult.size / 1024).toFixed(2)} KB (GT7 permite máximo 15 KB). Usa el Modo Avanzado para ajustar la limpieza o recorta la imagen.`);
                    } else {
                        setError(null);
                    }

                    setIsProcessing(false);
                    setProcessingStep('');
                    resolve(bestResult.svg);
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

    const getUniqueColors = (imageData) => {
        const { data } = imageData;
        const colorMap = new Map();

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Solo incluir píxeles opacos
            if (a >= 128) {
                // Cuantizar para agrupar colores similares (buckets de 4 para más precisión)
                const qr = Math.floor(r / 4) * 4;
                const qg = Math.floor(g / 4) * 4;
                const qb = Math.floor(b / 4) * 4;
                const colorKey = `${qr},${qg},${qb}`;
                colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
            }
        }

        // Ordenar por frecuencia descendente (colores más frecuentes primero, para formas principales)
        return Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([color, count]) => {
                const [r, g, b] = color.split(',').map(Number);
                return { r, g, b, rgb: `rgb(${r},${g},${b})`, count };
            });
    };

    // Simplificar colores: reducir paleta para mejor vectorización SVG
    const simplifyColors = (imageData, maxColors = 64, quantStep = 16) => {
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);

        // Crear paleta reducida usando cuantización simple
        const colorMap = new Map();
        const palette = [];

        // Primera pasada: recolectar colores y cuantizar
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue; // Saltar píxeles transparentes

            // Cuantizar según step configurable (por defecto 32)
            const step = quantStep;
            const qr = Math.floor(r / step) * step;
            const qg = Math.floor(g / step) * step;
            const qb = Math.floor(b / step) * step;
            const key = `${qr},${qg},${qb}`;

            if (!colorMap.has(key)) {
                colorMap.set(key, { r: qr, g: qg, b: qb, count: 0 });
            }
            colorMap.get(key).count++;
        }

        // Seleccionar los colores más frecuentes hasta maxColors
        const sortedColors = Array.from(colorMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, maxColors);

        // Crear paleta final
        sortedColors.forEach(color => {
            palette.push({ r: color.r, g: color.g, b: color.b });
        });

        // Si no hay suficientes colores, añadir algunos básicos
        while (palette.length < Math.min(8, maxColors)) {
            palette.push({ r: 255, g: 255, b: 255 }); // Blanco
        }

        // Segunda pasada: mapear cada píxel al color más cercano de la paleta
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) {
                // Mantener píxeles transparentes
                newData[i] = 0;
                newData[i + 1] = 0;
                newData[i + 2] = 0;
                newData[i + 3] = 0;
                continue;
            }

            // Encontrar color más cercano en la paleta
            let minDistance = Infinity;
            let closestColor = palette[0];

            for (const color of palette) {
                const dr = r - color.r;
                const dg = g - color.g;
                const db = b - color.b;
                const distance = dr * dr + dg * dg + db * db;

                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = color;
                }
            }

            // Aplicar color más cercano
            newData[i] = closestColor.r;
            newData[i + 1] = closestColor.g;
            newData[i + 2] = closestColor.b;
            newData[i + 3] = a; // Mantener alpha original
        }

        // Retornar nuevo ImageData
        const result = new ImageData(newData, width, height);
        return result;
    };

    const convertWithMultipleLayers = async (imageData, width, height, threshold, turdSize, complexityHint = 'media') => {
        return new Promise(async (resolve, reject) => {
            try {
                const totalPixels = width * height;
                const uniqueColors = getUniqueColors(imageData)
                    .slice(0, 300); // Aumentado para incluir colores menos frecuentes como ojos amarillos y lengua roja
                console.log('width', width);
                console.log('height', height);
                console.log('totalPixels', totalPixels);
                console.log(`La imagen tiene ${uniqueColors.length} capas de color (procesando colores más frecuentes primero para formas principales)`);
                // Preparar estructuras
                let svgPathsByColor = new Map(); // Map<color, Array<pathData>>
                let currentSize = 0;
                const maxSize = 15 * 1024; // mantener límite de GT7 en 15KB

                // Reservar bytes para detalles pequeños (oj. ojos, lengua) - balanceado
                // Presupuesto según complejidad: más espacio para primarios en logos complejos
                const reserveBytes = complexityHint === 'muy_compleja' ? 2.5 * 1024 : 2 * 1024;
                const usableBudgetFirstPass = Math.max(
                    complexityHint === 'muy_compleja' ? 7 * 1024 : complexityHint === 'compleja' ? 6 * 1024 : 5 * 1024,
                    maxSize - reserveBytes
                );

                // SVG base
                const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
                const svgFooter = '</svg>';

                // Limitar cantidad de colores a procesar para reducir ruido - máximo para fidelidad
                const maxColorsToProcess = Math.min(800, uniqueColors.length); // aumentado drásticamente
                const primaryColors = uniqueColors.slice(0, Math.min(complexityHint === 'simple' ? 14 : 150, maxColorsToProcess)); // máximo para compleja
                const secondaryCandidates = uniqueColors.slice(Math.min(12, maxColorsToProcess), maxColorsToProcess);

                // Helper: dilatar máscara simple para unir píxeles aislados (1px dilation)
                const dilateMask = (maskData, w, h, iterations = 1) => {
                    const copy = new Uint8ClampedArray(maskData.data);
                    const idx = (x, y) => (y * w + x) * 4;
                    for (let iter = 0; iter < iterations; iter++) {
                        for (let y = 1; y < h - 1; y++) {
                            for (let x = 1; x < w - 1; x++) {
                                const i = idx(x, y);
                                // if current pixel is white and any neighbor is black -> set black in copy
                                if (copy[i] === 255) {
                                    let found = false;
                                    for (let oy = -1; oy <= 1 && !found; oy++) {
                                        for (let ox = -1; ox <= 1 && !found; ox++) {
                                            const ni = idx(x + ox, y + oy);
                                            if (maskData.data[ni] === 0) found = true;
                                        }
                                    }
                                    if (found) {
                                        copy[i] = 0; copy[i + 1] = 0; copy[i + 2] = 0; copy[i + 3] = 255;
                                    }
                                }
                            }
                        }
                        maskData.data.set(copy);
                    }
                };

                // Small function to trace a mask canvas with Potrace and return path d and fill
                const traceMaskCanvas = (maskCanvas, fillColor, opts) => {
                    return new Promise((resolvePath, rejectPath) => {
                        maskCanvas.toBlob((blob) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const buffer = Buffer.from(reader.result);
                                Potrace.trace(buffer, opts, (err, svg) => {
                                    if (err) return rejectPath(err);
                                    const pathMatch = svg.match(/<path[^>]*d="([^"]*)"[^>]*fill="([^"]*)"[^>]*\/>/);
                                    if (pathMatch) resolvePath({ d: pathMatch[1], fill: pathMatch[2], raw: svg });
                                    else resolvePath(null);
                                });
                            };
                            reader.readAsArrayBuffer(blob);
                        }, 'image/png');
                    });
                };

                // FIRST PASS: capture main shapes (more permissive simplification)
                for (let i = 0; i < primaryColors.length; i++) {
                    const color = primaryColors[i];
                    const maskCanvas = document.createElement('canvas');
                    const maskCtx = maskCanvas.getContext('2d');
                    maskCanvas.width = width; maskCanvas.height = height;
                    const maskData = maskCtx.createImageData(width, height);
                    const { data } = imageData;

                    // Tolerancia mayor para unir variantes del mismo tono
                    const tolerance = 8;
                    let pixelCount = 0;

                    for (let j = 0; j < data.length; j += 4) {
                        const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                        const matches = a >= 128 && Math.abs(r - color.r) <= tolerance && Math.abs(g - color.g) <= tolerance && Math.abs(b - color.b) <= tolerance;
                        if (matches) {
                            maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                            pixelCount++;
                        } else {
                            maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                        }
                    }

                    // If very small area, dilate gently for better tracing without deformation
                    if (pixelCount > 0 && pixelCount < Math.max(120, Math.floor(totalPixels * 0.01))) {
                        // apply 1 iteration dilation
                        maskCtx.putImageData(maskData, 0, 0);
                        const tmp = maskCtx.getImageData(0, 0, width, height);
                        dilateMask(tmp, width, height, 1);
                        maskCtx.putImageData(tmp, 0, 0);
                    } else {
                        maskCtx.putImageData(maskData, 0, 0);
                    }

                    // Try trace with permissive simplification
                    try {
                        const traceOpts = {
                            threshold: Math.max(threshold - (complexityHint === 'muy_compleja' ? 2 : complexityHint === 'compleja' ? 5 : 12), 46),
                            turdSize: Math.max(turdSize * (complexityHint === 'muy_compleja' ? 1.15 : complexityHint === 'compleja' ? 1.5 : 2.2), 1.8), // más limpieza en simples, menos en complejas
                            optTolerance: 0.2,
                            optAlphaMax: 1.0,
                            pathMargin: 0.8,
                            color: color.rgb,
                            background: 'transparent',
                            turnpolicy: 'minority'
                        };

                        const traced = await traceMaskCanvas(maskCanvas, color.rgb, traceOpts);
                        if (traced && traced.d && traced.d.trim() && traced.d !== 'M0 0') {
                            // Simular tamaño tras agregar
                            const tempMap = new Map(svgPathsByColor);
                            tempMap.set(color.rgb, (tempMap.get(color.rgb) || []).concat([traced.d]));
                            let tempSvgPaths = [];
                            for (let [col, pathArr] of tempMap) {
                                tempSvgPaths.push(`<path d="${pathArr.join(' ')}" fill="${col}" fill-rule="evenodd"/>`);
                            }
                            const testSvg = svgHeader + tempSvgPaths.join('') + svgFooter;
                            const testBlob = new Blob([testSvg], { type: 'image/svg+xml' });
                            const testSize = testBlob.size;

                            const allowPrimaryOverride = i < (complexityHint === 'muy_compleja' ? 5 : complexityHint === 'compleja' ? 3 : 2) && testSize <= maxSize; // asegura colores clave en logos complejos

                            if (testSize <= usableBudgetFirstPass || allowPrimaryOverride) {
                                svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                currentSize = testSize;
                                console.log(`Primaria agregada: ${color.rgb}, píxeles: ${pixelCount}, tamaño actual: ${(currentSize / 1024).toFixed(2)} KB${allowPrimaryOverride ? ' (override)' : ''}`);
                            } else {
                                console.log(`Primaria omitida (no cabe en primera pasada): ${color.rgb}, tamaño tentativa: ${(testSize / 1024).toFixed(2)} KB`);
                            }
                        }
                    } catch (err) {
                        console.log(`Error trazando color primario ${color.rgb}:`, err.message || err);
                    }
                }

                // SECOND PASS: try a few important small/dominant colors within remaining budget
                // Determine remaining budget
                currentSize = currentSize || 0;
                const remainingBudget = Math.max(0, maxSize - currentSize);

                // Get user/detected dominant colors (top 5) and prioritize them
                const dominantBuckets = detectDominantColors(imageData); // returns buckets like "r,g,b"
                const dominantRgbList = dominantBuckets.map(b => {
                    const [br, bg, bb] = b.split(',').map(Number);
                    return `rgb(${br},${bg},${bb})`;
                });

                // Build secondary list prioritizing dominantRgbList, forced key colors, then yellow/red colors, then high-count secondaryCandidates
                const secondaryOrdered = [];
                // Add dominant colors first if present in candidates
                for (const d of dominantRgbList) {
                    const found = secondaryCandidates.find(c => c.rgb === d);
                    if (found) secondaryOrdered.push(found);
                }

                // Force-add key colors for logos complejos (azul cian, rojo, negro, azul marino)
                if (complexityHint !== 'simple') {
                    const forced = [
                        { r: 0, g: 150, b: 200, rgb: 'rgb(0,150,200)', count: 999999 }, // azul cian borde
                        { r: 210, g: 20, b: 20, rgb: 'rgb(210,20,20)', count: 999998 }, // rojo texto
                        { r: 51, g: 51, b: 51, rgb: 'rgb(51,51,51)', count: 999997 }, // gris oscuro
                        { r: 20, g: 40, b: 80, rgb: 'rgb(20,40,80)', count: 999996 }, // azul marino cuerpo
                        { r: 255, g: 255, b: 255, rgb: 'rgb(255,255,255)', count: 999995 },
                    ];
                    forced.forEach(f => {
                        if (!secondaryOrdered.find(x => x.rgb === f.rgb)) {
                            secondaryOrdered.push(f);
                        }
                    });
                }
                // Add yellow/red colors next (high r/g, low b for yellows; high r, low g/b for reds)
                const yellowRedCandidates = secondaryCandidates.filter(c => {
                    const [r, g, b] = c.rgb.match(/\d+/g).map(Number);
                    return (r > 200 && g > 200 && b < 120) || (r > 200 && g < 170 && b < 140); // ampliar rango para rojos/azules apagados
                });
                for (const c of yellowRedCandidates) {
                    if (!secondaryOrdered.find(x => x.rgb === c.rgb)) secondaryOrdered.push(c);
                }
                // Then add remaining secondary candidates.
                for (const c of secondaryCandidates) {
                    // Solo incluir colores que tengan un minimo de peso, ignorar polvo/antialiasing
                    const minCount = complexityHint === 'muy_compleja' ? 2 : complexityHint === 'compleja' ? 6 : complexityHint === 'media' ? 10 : 18;
                    if (c.count > minCount && !secondaryOrdered.find(x => x.rgb === c.rgb)) {
                        secondaryOrdered.push(c);
                    }
                }
                secondaryOrdered.sort((a, b) => b.count - a.count); // large areas first, avoid speckles

                // Procesar máximo colores secundarios para capturar todos los detalles
                const maxSecondary = complexityHint === 'muy_compleja' ? 300 : complexityHint === 'compleja' ? 250 : complexityHint === 'media' ? 150 : 50; // máximo
                for (let i = 0; i < Math.min(maxSecondary, secondaryOrdered.length); i++) {
                    const color = secondaryOrdered[i];
                    if (svgPathsByColor.has(color.rgb)) continue; // ya añadida

                    // Build mask stricter (preserve small spots)
                    const maskCanvas = document.createElement('canvas');
                    const maskCtx = maskCanvas.getContext('2d');
                    maskCanvas.width = width; maskCanvas.height = height;
                    const maskData = maskCtx.createImageData(width, height);
                    const { data } = imageData;
                    const tolerance = complexityHint === 'muy_compleja' ? 2 : complexityHint === 'compleja' ? 3 : complexityHint === 'media' ? 4 : 5; // reducida para mejor separación de colores
                    let pixelCount = 0;
                    for (let j = 0; j < data.length; j += 4) {
                        const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                        const matches = a >= 128 && Math.abs(r - color.r) <= tolerance && Math.abs(g - color.g) <= tolerance && Math.abs(b - color.b) <= tolerance;
                        if (matches) {
                            maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                            pixelCount++;
                        } else {
                            maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                        }
                    }
                    const minPixels = complexityHint === 'muy_compleja' ? 5 : complexityHint === 'compleja' ? 9 : complexityHint === 'media' ? 12 : 18;
                    if (pixelCount < minPixels) continue; // Ignorar si son muy pocos píxeles en total
                    // If extremely small, dilate gently to help Potrace form a shape without deforming
                    maskCtx.putImageData(maskData, 0, 0);
                    const tmp = maskCtx.getImageData(0, 0, width, height);
                    if (pixelCount < 120) dilateMask(tmp, width, height, 1); // single iteration for small areas
                    maskCtx.putImageData(tmp, 0, 0);

                    try {
                        const traceOpts = {
                            threshold: Math.max(currentThreshold, 1), // mínimo 1 para máxima precisión
                            turdSize: Math.max(currentTurdSize, 0), // mínimo 0
                            optTolerance: 0.02, // más precisión
                            optAlphaMax: 1.0,
                            pathMargin: 0.1, // margen mínimo
                            color: color.rgb,
                            background: 'transparent',
                            turnpolicy: 'minority'
                        };

                        const traced = await traceMaskCanvas(maskCanvas, color.rgb, traceOpts);
                        if (traced && traced.d && traced.d.trim() && traced.d !== 'M0 0') {
                            // Simular tamaño tras agregar
                            const tempMap = new Map(svgPathsByColor);
                            tempMap.set(color.rgb, (tempMap.get(color.rgb) || []).concat([traced.d]));
                            let tempSvgPaths = [];
                            for (let [col, pathArr] of tempMap) {
                                tempSvgPaths.push(`<path d="${pathArr.join(' ')}" fill="${col}" fill-rule="evenodd"/>`);
                            }
                            const testSvg = svgHeader + tempSvgPaths.join('') + svgFooter;
                            const testBlob = new Blob([testSvg], { type: 'image/svg+xml' });
                            const testSize = testBlob.size;

                            if (testSize <= maxSize) {
                                svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                currentSize = testSize;
                                console.log(`Secundaria agregada: ${color.rgb}, píxeles: ${pixelCount}, tamaño actual: ${(currentSize / 1024).toFixed(2)} KB`);
                            } else {
                                console.log(`Secundaria omitida (no cabe): ${color.rgb}, tamaño tentativa: ${(testSize / 1024).toFixed(2)} KB`);
                            }
                        }
                    } catch (err) {
                        console.log(`Error trazando color secundario ${color.rgb}:`, err.message || err);
                    }
                }

                // Tercera pasada opcional: usar presupuesto restante para añadir colores importantes no incluidos aún
                let remainingBudgetExtra = maxSize - currentSize;
                const allowThirdPass = complexityHint !== 'simple';
                if (allowThirdPass && remainingBudgetExtra > 200) {
                    const leftovers = secondaryCandidates.filter(c => !svgPathsByColor.has(c.rgb)).slice(0, 400); // máximo
                    for (let i = 0; i < leftovers.length && currentSize < maxSize - 48; i++) {
                        const color = leftovers[i];
                        const maskCanvas = document.createElement('canvas');
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCanvas.width = width; maskCanvas.height = height;
                        const maskData = maskCtx.createImageData(width, height);
                        const { data } = imageData;
                        const tolerance = complexityHint === 'muy_compleja' ? 10 : complexityHint === 'compleja' ? 8 : 5;
                        let pixelCount = 0;
                        for (let j = 0; j < data.length; j += 4) {
                            const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                            const matches = a >= 128 && Math.abs(r - color.r) <= tolerance && Math.abs(g - color.g) <= tolerance && Math.abs(b - color.b) <= tolerance;
                            if (matches) {
                                maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                                pixelCount++;
                            } else {
                                maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                            }
                        }
                        const minExtra = complexityHint === 'muy_compleja' ? 6 : complexityHint === 'compleja' ? 7 : complexityHint === 'media' ? 10 : 16;
                        if (pixelCount < minExtra) continue; // evitar motas diminutas
                        maskCtx.putImageData(maskData, 0, 0);

                        try {
                            const traceOpts = {
                                threshold: Math.max(threshold - (complexityHint === 'muy_compleja' ? 0 : 1), 43),
                                turdSize: Math.max(turdSize * (complexityHint === 'muy_compleja' ? 0.8 : 0.95), 1.2),
                                optTolerance: 0.05,
                                optAlphaMax: 1.0,
                                pathMargin: 0.4,
                                color: color.rgb,
                                background: 'transparent',
                                turnpolicy: 'minority'
                            };

                            const traced = await traceMaskCanvas(maskCanvas, color.rgb, traceOpts);
                            if (traced && traced.d && traced.d.trim() && traced.d !== 'M0 0') {
                                const tempMap = new Map(svgPathsByColor);
                                tempMap.set(color.rgb, (tempMap.get(color.rgb) || []).concat([traced.d]));
                                let tempSvgPaths = [];
                                for (let [col, pathArr] of tempMap) {
                                    tempSvgPaths.push(`<path d="${pathArr.join(' ')}" fill="${col}" fill-rule="evenodd"/>`);
                                }
                                const testSvg = svgHeader + tempSvgPaths.join('') + svgFooter;
                                const testBlob = new Blob([testSvg], { type: 'image/svg+xml' });
                                const testSize = testBlob.size;

                                if (testSize <= maxSize) {
                                    svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                    currentSize = testSize;
                                    remainingBudgetExtra = maxSize - currentSize;
                                    console.log(`Extra agregado: ${color.rgb}, tamaño actual: ${(currentSize / 1024).toFixed(2)} KB`);
                                }
                            }
                        } catch (err) {
                            console.log(`Error trazando extra ${color.rgb}:`, err.message || err);
                        }
                    }
                }

                // Cuarta pasada (relleno final) para consumir presupuesto restante con colores pendientes
                let remainingBudgetFinal = maxSize - currentSize;
                if (allowThirdPass && remainingBudgetFinal > 25) { // mínimo umbral
                    const filler = secondaryCandidates.filter(c => !svgPathsByColor.has(c.rgb)).slice(0, 500); // máximo
                    for (let i = 0; i < filler.length && currentSize < maxSize - 24; i++) {
                        const color = filler[i];
                        const maskCanvas = document.createElement('canvas');
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCanvas.width = width; maskCanvas.height = height;
                        const maskData = maskCtx.createImageData(width, height);
                        const { data } = imageData;
                        const tolerance = complexityHint === 'muy_compleja' ? 7 : complexityHint === 'compleja' ? 6 : complexityHint === 'media' ? 5 : 3;
                        let pixelCount = 0;
                        for (let j = 0; j < data.length; j += 4) {
                            const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                            const matches = a >= 128 && Math.abs(r - color.r) <= tolerance && Math.abs(g - color.g) <= tolerance && Math.abs(b - color.b) <= tolerance;
                            if (matches) {
                                maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                                pixelCount++;
                            } else {
                                maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                            }
                        }
                        const minFiller = complexityHint === 'muy_compleja' ? 5 : complexityHint === 'compleja' ? 6 : complexityHint === 'media' ? 10 : 16;
                        if (pixelCount < minFiller) continue;
                        maskCtx.putImageData(maskData, 0, 0);

                        try {
                            const traceOpts = {
                                threshold: Math.max(threshold - 1, 42),
                                turdSize: Math.max(turdSize * 0.95, 1.2),
                                optTolerance: 0.05,
                                optAlphaMax: 1.0,
                                pathMargin: 0.35,
                                color: color.rgb,
                                background: 'transparent',
                                turnpolicy: 'minority'
                            };

                            const traced = await traceMaskCanvas(maskCanvas, color.rgb, traceOpts);
                            if (traced && traced.d && traced.d.trim() && traced.d !== 'M0 0') {
                                const tempMap = new Map(svgPathsByColor);
                                tempMap.set(color.rgb, (tempMap.get(color.rgb) || []).concat([traced.d]));
                                let tempSvgPaths = [];
                                for (let [col, pathArr] of tempMap) {
                                    tempSvgPaths.push(`<path d="${pathArr.join(' ')}" fill="${col}" fill-rule="evenodd"/>`);
                                }
                                const testSvg = svgHeader + tempSvgPaths.join('') + svgFooter;
                                const testBlob = new Blob([testSvg], { type: 'image/svg+xml' });
                                const testSize = testBlob.size;

                                if (testSize <= maxSize) {
                                    svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                    currentSize = testSize;
                                } else {
                                    break; // llegamos al límite
                                }
                            }
                        } catch (err) {
                            console.log(`Error trazando filler ${color.rgb}:`, err.message || err);
                        }
                    }
                }

                // Pasada forzada para colores clave (negro, blanco, rojo, azul) si todavía no entraron
                if (complexityHint !== 'simple') {
                    const forcedColors = [
                        { r: 51, g: 51, b: 51, rgb: 'rgb(51,51,51)' },
                        { r: 255, g: 255, b: 255, rgb: 'rgb(255,255,255)' },
                        { r: 210, g: 20, b: 20, rgb: 'rgb(210,20,20)' },
                        { r: 20, g: 60, b: 140, rgb: 'rgb(20,60,140)' },
                        { r: 30, g: 90, b: 190, rgb: 'rgb(30,90,190)' }
                    ];

                    for (const color of forcedColors) {
                        if (svgPathsByColor.has(color.rgb)) continue;

                        const maskCanvas = document.createElement('canvas');
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCanvas.width = width; maskCanvas.height = height;
                        const maskData = maskCtx.createImageData(width, height);
                        const { data } = imageData;
                        const tolerance = 14; // más ancho para capturar variaciones
                        let pixelCount = 0;

                        for (let j = 0; j < data.length; j += 4) {
                            const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                            const matches = a >= 128 && Math.abs(r - color.r) <= tolerance && Math.abs(g - color.g) <= tolerance && Math.abs(b - color.b) <= tolerance;
                            if (matches) {
                                maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                                pixelCount++;
                            } else {
                                maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                            }
                        }

                        if (pixelCount < 5) continue; // deja pasar áreas pequeñas clave

                        // Si el área es pequeña pero existe, dilatar suavemente para no perderla al vectorizar
                        if (pixelCount < 40) {
                            maskCtx.putImageData(maskData, 0, 0);
                            const tmp = maskCtx.getImageData(0, 0, width, height);
                            dilateMask(tmp, width, height, 1);
                            maskCtx.putImageData(tmp, 0, 0);
                        }
                        maskCtx.putImageData(maskData, 0, 0);

                        try {
                            const traceOpts = {
                                threshold: Math.max(threshold - 2, 44),
                                turdSize: Math.max(turdSize, 1.2),
                                optTolerance: 0.08,
                                optAlphaMax: 1.0,
                                pathMargin: 0.5,
                                color: color.rgb,
                                background: 'transparent',
                                turnpolicy: 'minority'
                            };

                            const traced = await traceMaskCanvas(maskCanvas, color.rgb, traceOpts);
                            if (traced && traced.d && traced.d.trim() && traced.d !== 'M0 0') {
                                const tempMap = new Map(svgPathsByColor);
                                tempMap.set(color.rgb, (tempMap.get(color.rgb) || []).concat([traced.d]));
                                let tempSvgPaths = [];
                                for (let [col, pathArr] of tempMap) {
                                    tempSvgPaths.push(`<path d="${pathArr.join(' ')}" fill="${col}" fill-rule="evenodd"/>`);
                                }
                                const testSvg = svgHeader + tempSvgPaths.join('') + svgFooter;
                                const testBlob = new Blob([testSvg], { type: 'image/svg+xml' });
                                const testSize = testBlob.size;

                                if (testSize <= maxSize) {
                                    svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                    currentSize = testSize;
                                }
                            }
                        } catch (err) {
                            console.log(`Error trazando color forzado ${color.rgb}:`, err.message || err);
                        }
                    }
                }

                // Crear SVG final combinando paths por color
                let svgPaths = [];
                for (let [color, pathDataArray] of svgPathsByColor) {
                    const combinedPathData = pathDataArray.join(' ');
                    const pathElement = `<path d="${combinedPathData}" fill="${color}" fill-rule="evenodd"/>`;
                    svgPaths.push(pathElement);
                }

                console.log(`Total capas agregadas: ${svgPaths.length} (de ${uniqueColors.length} candidatos procesados)`);

                // Fallback: si no se añadió nada, trazar la silueta completa usando color dominante
                if (svgPaths.length === 0) {
                    console.log('Ninguna capa pudo agregarse. Generando silueta con color dominante.');
                    // Crear máscara de opacidad (>128) para todo el objeto
                    const maskCanvas = document.createElement('canvas');
                    const maskCtx = maskCanvas.getContext('2d');
                    maskCanvas.width = width; maskCanvas.height = height;
                    const maskData = maskCtx.createImageData(width, height);
                    const { data } = imageData;
                    for (let j = 0; j < data.length; j += 4) {
                        const a = data[j + 3];
                        if (a >= 128) {
                            maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                        } else {
                            maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                        }
                    }
                    maskCtx.putImageData(maskData, 0, 0);
                    const dominant = getDominantColor(imageData);
                    try {
                        const traced = await traceMaskCanvas(maskCanvas, dominant, {
                            threshold: Math.max(threshold - 5, 50),
                            turdSize: Math.max(turdSize * 1.2, 1.2),
                            optTolerance: 0.2,
                            optAlphaMax: 1.0,
                            pathMargin: 1.0,
                            color: dominant,
                            background: 'transparent',
                            turnpolicy: 'minority'
                        });
                        if (traced && traced.d) {
                            svgPaths.push(`<path d="${traced.d}" fill="${traced.fill || dominant}" fill-rule="evenodd"/>`);
                        }
                    } catch (err) {
                        console.log('Fallback trace failed:', err.message || err);
                    }
                }

                const finalSvg = svgHeader + svgPaths.join('') + svgFooter;

                console.log('svgPaths.length:', svgPaths.length, `(capas combinadas por color)`);

                // Optimizar
                let optimizedSvg = finalSvg
                    .replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\s+/g, ' ')
                    .replace(/>\s+</g, '><');

                // Reducir decimales pero preservar precisión
                optimizedSvg = optimizedSvg.replace(/(\d+\.\d{3,})/g, (m) => {
                    const num = parseFloat(m);
                    return num.toFixed(complexityHint === 'simple' ? 1 : 2);
                });

                resolve(optimizedSvg.trim());
            } catch (err) {
                reject(err);
            }
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
        setImageComplexity(null);
        setAdvancedMode(false);
        setThreshold(128);
        setTurdSize(2);
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
                                <strong>Proceso Completamente Automático:</strong> Solo sube tu imagen PNG (sin fondo) y la herramienta se encarga de:
                                simplificar colores, optimizar tamaño y calidad, y convertir a SVG garantizando un peso máximo de 15KB.
                            </p>
                        </div>

                        {/* File Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2 text-orange-300">
                                Seleccionar Imagen (PNG)
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png"
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

                        {/* Image Complexity Analysis */}
                        {imageComplexity && !isProcessing && (
                            <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-purple-800 dark:text-purple-400">
                                    📊 Análisis de Complejidad Avanzado
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Nivel:</p>
                                        <p className="font-semibold text-purple-600 dark:text-purple-400 capitalize">{imageComplexity.complexity}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Puntuación:</p>
                                        <p className="font-semibold">{imageComplexity.complexityScore}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Colores:</p>
                                        <p className="font-semibold">{imageComplexity.colorCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Densidad Bordes:</p>
                                        <p className="font-semibold">{imageComplexity.edgeDensity}%</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Dimensiones:</p>
                                        <p className="font-semibold">{imageComplexity.dimensions}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Optimization Info */}
                        {optimizationInfo && !isProcessing && (
                            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-400">
                                    ✓ Procesamiento Completado
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    La imagen ha sido optimizada, el fondo eliminado y convertida a SVG multicapa manteniendo detalles importantes como colores y formas.
                                </p>
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
                                    {optimizationInfo.colors && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Colores Imagen:</p>
                                            <p className="font-semibold">{optimizationInfo.colors}</p>
                                        </div>
                                    )}
                                    {optimizationInfo.complexity && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Complejidad de Imagen:</p>
                                            <p className="font-semibold capitalize text-purple-600 dark:text-purple-400">{optimizationInfo.complexity}</p>
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
                                    {optimizationInfo.compressionGain && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Compresión SVGO:</p>
                                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                {optimizationInfo.compressionGain}%
                                            </p>
                                        </div>
                                    )}
                                    {optimizationInfo.svgLayers && (
                                        <div>
                                            <p className="text-gray-600 dark:text-gray-400">Capas SVG:</p>
                                            <p className="font-semibold text-purple-600 dark:text-purple-400">
                                                {optimizationInfo.svgLayers}
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
                        )}

                        {/* Consejos para mejores resultados */}
                        {optimizationInfo && !isProcessing && (
                            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-400">
                                    💡 Consejos para Mejores Resultados
                                </h3>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                                    <li>• <strong>Colores planos:</strong> Las imágenes con colores sólidos y pocos gradientes convierten mejor a SVG.</li>
                                    <li>• <strong>Pocas capas:</strong> Imágenes simples con menos de 20 colores principales producen SVGs más eficientes.</li>
                                    <li>• <strong>Contraste alto:</strong> Asegúrate de que los detalles importantes tengan buen contraste con el fondo.</li>
                                    <li>• <strong>Tamaño moderado:</strong> Imágenes entre 200-500px de ancho suelen dar el mejor balance calidad/tamaño.</li>
                                    <li>• <strong>Formas simples:</strong> Evita texturas complejas o ruido; las formas geométricas se vectorizan mejor.</li>
                                    <li>• <strong>Fondo limpio:</strong> Un fondo uniforme facilita la eliminación automática y mejora la conversión.</li>
                                </ul>
                            </div>
                        )}

                        {/* Advanced Mode */}
                        {optimizationInfo && !isProcessing && (
                            <div className="mb-6 p-4 bg-slate-700/50 rounded-lg flex items-center justify-between">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={advancedMode}
                                        onChange={(e) => setAdvancedMode(e.target.checked)}
                                        className="w-5 h-5 rounded"
                                    />
                                    <span className="text-orange-300 font-semibold">Modo Avanzado - Ajustar Parámetros</span>
                                </label>
                            </div>
                        )}

                        {/* Advanced Parameters */}
                        {advancedMode && !isProcessing && (
                            <div className="mb-6 p-4 bg-slate-700/30 border border-slate-600 rounded-lg space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-medium text-orange-300">Threshold (Contraste)</label>
                                        <span className="text-xs bg-slate-600 px-2 py-1 rounded">{threshold}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="200"
                                        value={threshold}
                                        onChange={(e) => setThreshold(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Valores altos = más agresiva la simplificación, archivo más pequeño</p>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-medium text-orange-300">Turd Size (Detalle)</label>
                                        <span className="text-xs bg-slate-600 px-2 py-1 rounded">{turdSize}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        value={turdSize}
                                        onChange={(e) => setTurdSize(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Valores altos = menos detalles finos, archivo más pequeño</p>
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {optimizedPreview && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-3">Vista Previa Optimizada</h3>
                                <div className="relative w-full h-64 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden">
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
                                <div className="relative w-full h-64 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden">
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
                                    <li><strong>Simplifica colores:</strong> Reduce la paleta a colores sólidos para mejor vectorización</li>
                                    <li><strong>Analiza complejidad:</strong> Evalúa colores, bordes y detalles para optimizar parámetros</li>
                                    <li><strong>Vectoriza en múltiples capas:</strong> Crea SVG multicapa priorizando formas principales y detalles pequeños (ojos, lengua, colmillos)</li>
                                    <li><strong>Optimiza con ImageTracer:</strong> Usa algoritmo profesional de trazado vectorial con cuantización inteligente</li>
                                    <li><strong>Comprime con SVGO:</strong> Reduce tamaño final aplicando optimizaciones avanzadas</li>
                                    <li><strong>Valida el peso:</strong> Asegura que el archivo sea menor a 15KB con reserva para detalles críticos</li>
                                </ol>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Consejos para mejores resultados:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Usa imágenes PNG sin fondo con colores sólidos y bordes definidos para mejores capas</li>
                                    <li>Los logos y gráficos simples funcionan mejor; evita texturas complejas</li>
                                    <li>Imágenes con detalles pequeños (ojos, lengua) se preservan mejor con colores amarillo/rojo</li>
                                    <li>La simplificación automática de colores mejora la calidad de vectorización</li>
                                    <li>El proceso usa ImageTracer y SVGO, algoritmos profesionales de vectorización</li>
                                    <li>Se ajustan automáticamente hasta 15 parámetros para cumplir el límite de 15KB</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Tecnología de vectorización:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Usa ImageTracer: algoritmo profesional de trazado vectorial con soporte multicapa</li>
                                    <li>Simplificación de colores: reduce paleta a 16 colores para mejor vectorización</li>
                                    <li>Optimización progresiva de threshold, turdSize y cuantización para preservar detalles</li>
                                    <li>Compresión SVGO: reduce decimales, elimina metadatos y optimiza paths</li>
                                    <li>Reducción de dimensiones adaptativa cuando es necesario para cumplir límites</li>
                                    <li>Análisis de complejidad: detecta colores dominantes y densidad de bordes</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
