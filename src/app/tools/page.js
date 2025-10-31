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
        let recThreshold = 120;
        let recTurdSize = 1;

        if (complexityScore > 35) {
            complexity = 'muy_compleja';
            recThreshold = 118;
            recTurdSize = 1;
        } else if (complexityScore > 20) {
            complexity = 'compleja';
            recThreshold = 120;
            recTurdSize = 1;
        } else if (complexityScore > 10) {
            complexity = 'media';
            recThreshold = 122;
            recTurdSize = 1;
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

    // Comprimir SVG
    const compressSvgWithSVGO = (svg) => {
        let compressed = svg;
        compressed = compressed.replace(/(\d+\.\d{2,})/g, (m) => parseFloat(m).toFixed(1));
        compressed = compressed.replace(/\s+(version|xmlns:xlink)="[^"]*"/g, '');
        compressed = compressed.replace(/stroke="none"/gi, '');
        compressed = compressed.replace(/\s+M\s+/g, 'M').replace(/\s+L\s+/g, 'L').replace(/\s+C\s+/g, 'C');
        return compressed;
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
                const data = imageData.data;

                // PIPELINE AVANZADO: Detección inteligente de fondo
                // Analizar múltiples esquinas y centro para encontrar patrón de fondo
                const samplePoints = [
                    { x: 0, y: 0 }, { x: canvas.width - 1, y: 0 },
                    { x: 0, y: canvas.height - 1 }, { x: canvas.width - 1, y: canvas.height - 1 },
                    { x: Math.floor(canvas.width * 0.1), y: Math.floor(canvas.height * 0.1) },
                    { x: Math.floor(canvas.width * 0.9), y: Math.floor(canvas.height * 0.1) },
                    { x: Math.floor(canvas.width * 0.1), y: Math.floor(canvas.height * 0.9) },
                    { x: Math.floor(canvas.width * 0.9), y: Math.floor(canvas.height * 0.9) }
                ];

                const colorCounts = new Map();
                samplePoints.forEach(point => {
                    const i = (point.y * canvas.width + point.x) * 4;
                    const color = `${data[i]},${data[i + 1]},${data[i + 2]}`;
                    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
                });

                // Color de fondo es el más frecuente en los bordes
                let bgR = 255, bgG = 255, bgB = 255; // Asumir blanco por defecto
                let maxCount = 0;
                colorCounts.forEach((count, color) => {
                    if (count > maxCount) {
                        maxCount = count;
                        const [r, g, b] = color.split(',').map(Number);
                        bgR = r; bgG = g; bgB = b;
                    }
                });

                // Remover píxeles de fondo con threshold mejorado
                const threshold = 45; // Aumentado de 40 para mejor detección

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const dist = Math.sqrt(
                        Math.pow(r - bgR, 2) +
                        Math.pow(g - bgG, 2) +
                        Math.pow(b - bgB, 2)
                    );

                    if (dist < threshold) {
                        data[i + 3] = 0; // Transparencia
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL());
            };

            img.src = imageDataUrl;
        });
    };

    const processImageAutomatic = async (imageDataUrl, originalFile) => {
        try {
            // Paso 1: Omitido - eliminación de fondo (imágenes ya sin fondo)
            setProcessingStep('Procesando imagen...');

            // Paso 2: Optimizar tamaño y calidad
            setProcessingStep('Optimizando imagen...');
            const optimizedUrl = await optimizeImageSmart(imageDataUrl, originalFile);

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
                let maxSize = 200; // Reducido para más detalle en formas complejas

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

                // SIMPLIFICACIÓN DE COLORES: Reducir paleta para mejor vectorización
                const imageData = ctx.getImageData(0, 0, width, height);
                const simplifiedData = simplifyColors(imageData, 16); // Reducir a 16 colores máximo
                ctx.putImageData(simplifiedData, 0, 0);

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
                            backgroundRemoved: false, // Ya no se elimina fondo
                            complexity: complexity.complexity,
                            colors: complexity.colorCount,
                            colorSimplification: true
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

                    // Estrategia: comenzar con parámetros que preserven detalles
                    let svg = null;
                    let size = Infinity;
                    let currentThreshold = threshold; // Usar los parámetros recomendados
                    let currentTurdSize = turdSize;
                    let attempts = 0;
                    const maxAttempts = 12;
                    let sizeIncreasing = 0; // Contador de aumentos de tamaño

                    while (size > 15 * 1024 && attempts < maxAttempts) {
                        try {
                            // Solo reducir dimensiones como último recurso (después de intentos 8+)
                            if (attempts > 8 && currentWidth > 120) {
                                currentWidth = Math.floor(currentWidth * 0.90);
                                currentHeight = Math.floor(currentHeight * 0.90);
                                canvas.width = currentWidth;
                                canvas.height = currentHeight;
                                ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                            }

                            // Obtener datos de imagen
                            const imageData = ctx.getImageData(0, 0, currentWidth, currentHeight);

                            // Usar método multicapa con reducción de colores
                            svg = await convertWithMultipleLayers(imageData, currentWidth, currentHeight, currentThreshold, currentTurdSize);
                            console.log('SVG optimizado:', svg);
                            const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
                            size = svgBlob.size;

                            attempts++;

                            // Estrategia mejorada: aumentar parámetros de forma gradual
                            if (size > 15 * 1024) {
                                sizeIncreasing++;

                                // Primero aumentar threshold gradualmente (preserva más detalles)
                                if (sizeIncreasing <= 3) {
                                    currentThreshold += 5;
                                }
                                // Luego aumentar turdSize (elimina detalles pequeños)
                                else if (sizeIncreasing <= 6) {
                                    currentThreshold += 3;
                                    currentTurdSize += 1;
                                }
                                // Finalmente, ser muy agresivo
                                else {
                                    currentThreshold = Math.min(200, currentThreshold + 8);
                                    currentTurdSize += 2;
                                }

                                // Limitar máximos
                                currentThreshold = Math.min(220, currentThreshold);
                                currentTurdSize = Math.min(6, currentTurdSize);
                            }
                        } catch (err) {
                            console.error('Error en intento de conversión:', err);
                            attempts++;
                        }
                    }

                    setFileSize(size);

                    if (size > 15 * 1024) {
                        setError(`La imagen es muy compleja. Tamaño final: ${(size / 1024).toFixed(2)} KB. Usa Modo Avanzado para ajustar parámetros.`);
                        setIsProcessing(false);
                        setProcessingStep('');
                        reject(new Error('SVG demasiado grande'));
                    } else {
                        // Aplicar compresión SVGO
                        const compressedSvg = compressSvgWithSVGO(svg);
                        const compressedSize = new Blob([compressedSvg], { type: 'image/svg+xml' }).size;

                        console.log('Peso final del SVG:', (compressedSize / 1024).toFixed(2), 'KB');

                        // Contar capas SVG
                        const svgLayers = (compressedSvg.match(/<path/g) || []).length;

                        setSvgOutput(compressedSvg);
                        setOptimizationInfo(prev => ({
                            ...prev,
                            svgSize: (compressedSize / 1024).toFixed(2),
                            compressionGain: ((size - compressedSize) / size * 100).toFixed(1),
                            finalDimensions: currentWidth !== img.width ? `${currentWidth}x${currentHeight}` : null,
                            attempts,
                            finalThreshold: currentThreshold,
                            finalTurdSize: currentTurdSize,
                            svgLayers
                        }));
                        setFileSize(compressedSize);
                        setIsProcessing(false);
                        setProcessingStep('');
                        resolve(compressedSvg);
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
    const simplifyColors = (imageData, maxColors = 16) => {
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

            // Cuantizar a 8 niveles por canal (32^3 = 32768 colores posibles, reducible)
            const qr = Math.floor(r / 32) * 32;
            const qg = Math.floor(g / 32) * 32;
            const qb = Math.floor(b / 32) * 32;
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

    const convertWithMultipleLayers = async (imageData, width, height, threshold, turdSize) => {
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
                const maxSize = 15 * 1024; // 15KB

                // Reservar bytes para detalles pequeños (oj. ojos, lengua) - aumentado para dejar espacio
                const reserveBytes = 3.5 * 1024; // aumentado a 2KB para más espacio en secundaria
                const usableBudgetFirstPass = Math.max(4 * 1024, maxSize - reserveBytes); // garantizar al menos 4KB

                // SVG base
                const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
                const svgFooter = '</svg>';

                // Limitar cantidad de colores a procesar para reducir ruido - aumentado
                const maxColorsToProcess = Math.min(150, uniqueColors.length);
                const primaryColors = uniqueColors.slice(0, Math.min(15, maxColorsToProcess)); // principales aumentado
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
                            threshold: Math.max(threshold - 10, 50),
                            turdSize: Math.max(turdSize * 2.0, 2.0), // aumentado para más simplificación
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

                            if (testSize <= usableBudgetFirstPass) {
                                svgPathsByColor.set(color.rgb, (svgPathsByColor.get(color.rgb) || []).concat([traced.d]));
                                currentSize = testSize;
                                console.log(`Primaria agregada: ${color.rgb}, píxeles: ${pixelCount}, tamaño actual: ${(currentSize / 1024).toFixed(2)} KB`);
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

                // Build secondary list prioritizing dominantRgbList, then yellow/red colors, then high-count secondaryCandidates
                const secondaryOrdered = [];
                // Add dominant colors first if present in candidates
                for (const d of dominantRgbList) {
                    const found = secondaryCandidates.find(c => c.rgb === d);
                    if (found) secondaryOrdered.push(found);
                }
                // Add yellow/red colors next (high r/g, low b for yellows; high r, low g/b for reds)
                const yellowRedCandidates = secondaryCandidates.filter(c => {
                    const [r, g, b] = c.rgb.match(/\d+/g).map(Number);
                    return (r > 200 && g > 200 && b < 100) || (r > 200 && g < 150 && b < 100); // yellows and reds
                });
                for (const c of yellowRedCandidates) {
                    if (!secondaryOrdered.find(x => x.rgb === c.rgb)) secondaryOrdered.push(c);
                }
                // Then add remaining secondary candidates by count ascending (small areas first)
                for (const c of secondaryCandidates) {
                    if (!secondaryOrdered.find(x => x.rgb === c.rgb)) secondaryOrdered.push(c);
                }
                secondaryOrdered.sort((a, b) => a.count - b.count); // small areas first

                // Limit tries to avoid explosion - aumentado para incluir más colores
                const maxSecondary = 60;
                for (let i = 0; i < Math.min(maxSecondary, secondaryOrdered.length); i++) {
                    const color = secondaryOrdered[i];
                    if (svgPathsByColor.has(color.rgb)) continue; // ya añadida

                    // Build mask stricter (preserve small spots)
                    const maskCanvas = document.createElement('canvas');
                    const maskCtx = maskCanvas.getContext('2d');
                    maskCanvas.width = width; maskCanvas.height = height;
                    const maskData = maskCtx.createImageData(width, height);
                    const { data } = imageData;
                    const tolerance = 4; // less strict to capture color variations
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
                    if (pixelCount === 0) continue;
                    // If extremely small, dilate gently to help Potrace form a shape without deforming
                    maskCtx.putImageData(maskData, 0, 0);
                    const tmp = maskCtx.getImageData(0, 0, width, height);
                    if (pixelCount < 120) dilateMask(tmp, width, height, 1); // single iteration for small areas
                    maskCtx.putImageData(tmp, 0, 0);

                    try {
                        const traceOpts = {
                            threshold: Math.max(threshold - 5, 50),
                            turdSize: Math.max(turdSize * 1.0, 1.0), // back to default for more detail
                            optTolerance: 0.08, // back to default for more precision
                            optAlphaMax: 1.0,
                            pathMargin: 0.5,
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
                    return num.toFixed(2);
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
