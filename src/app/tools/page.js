'use client';

import { useState, useRef, useCallback } from 'react';
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

    // Drag & drop y validación GT7
    const [dragActive, setDragActive] = useState(false);
    const [gt7Validation, setGt7Validation] = useState(null);

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

    // Optimización avanzada de SVG (reemplaza la compresión básica anterior)
    const optimizeSvg = (svgString) => {
        let svg = svgString;

        // 1. Eliminar declaración XML si existe
        svg = svg.replace(/<\?xml[^?]*\?>\s*/g, '');

        // 2. Eliminar comentarios
        svg = svg.replace(/<!--[\s\S]*?-->/g, '');
        svg = svg.replace(/<desc>[\s\S]*?<\/desc>/gi, '');

        // 3. Optimizar path data (la mayor fuente de ahorro)
        svg = svg.replace(/ d="([^"]+)"/g, (match, pathData) => {
            let d = pathData;
            // Eliminar espacios redundantes
            d = d.replace(/\s+/g, ' ').trim();
            // Eliminar espacio después de comandos SVG
            d = d.replace(/([MLHVCSQTAZ])\s+/gi, '$1');
            // Usar signo negativo como separador implícito: "10 -5" → "10-5"
            d = d.replace(/(\d)\s+(-)/g, '$1$2');
            // Redondear a 1 decimal (esencial para mantener curvas suaves de Potrace)
            d = d.replace(/(\d+\.\d+)/g, (m) => parseFloat(m).toFixed(1));
            // Eliminar .0 innecesarios: "10.0" → "10"
            d = d.replace(/(\d+)\.0(?=[^.\d]|$)/g, '$1');
            // Eliminar ceros iniciales: "0.5" → ".5"
            d = d.replace(/\b0+(\.[\d]+)/g, '$1');
            return ` d="${d}"`;
        });

        // 4. Eliminar atributos innecesarios
        svg = svg.replace(/\s+stroke="none"/gi, '');
        svg = svg.replace(/\s+stroke="[^"]*"/gi, '');
        svg = svg.replace(/\s+fill-opacity="1"/gi, '');
        svg = svg.replace(/\s+stroke-opacity="1"/gi, '');
        svg = svg.replace(/\s+opacity="1"/gi, '');
        svg = svg.replace(/\s+stroke-width="0"/gi, '');
        svg = svg.replace(/fill="rgb\((\d+),(\d+),(\d+)\)"/gi, (match, r, g, b) => {
            const toHex = (value) => Number(value).toString(16).padStart(2, '0');
            const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            if (hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
                return `fill="#${hex[1]}${hex[3]}${hex[5]}"`;
            }
            return `fill="${hex}"`;
        });

        // 5. Compactar espacios en blanco restantes
        svg = svg.replace(/\s+/g, ' ');
        svg = svg.replace(/>\s+</g, '><');

        return svg.trim();
    };

    // Validar conformidad con requisitos de GT7
    const validateGT7Compliance = (svgString, fileBytes) => {
        const checks = [
            {
                label: 'Tamaño ≤ 15 kB',
                pass: fileBytes <= 15 * 1024,
                detail: `${(fileBytes / 1024).toFixed(2)} kB`
            },
            {
                label: 'SVG versión 1.0 o 1.1',
                pass: /version="1\.[01]"/.test(svgString),
                detail: svgString.match(/version="([^"]+)"/)?.[1] || 'No encontrada'
            },
            {
                label: 'Sin mapas de bits incrustados',
                pass: !/<image\b/.test(svgString) && !/data:image/.test(svgString),
                detail: /<image\b/.test(svgString) ? 'Contiene <image>' : 'OK'
            },
            {
                label: 'Sin modos de mezcla',
                pass: !/mix-blend-mode|multiply|screen|overlay|darken|lighten/i.test(svgString),
                detail: 'OK'
            },
            {
                label: 'Textos convertidos a contornos',
                pass: !/<text\b/.test(svgString),
                detail: /<text\b/.test(svgString) ? 'Contiene <text>' : 'OK — solo paths'
            }
        ];

        return {
            allPass: checks.every(c => c.pass),
            checks
        };
    };

    // Procesar archivo (compartido entre input y drag & drop)
    const processFile = async (file) => {
        // Validar que sea PNG
        const isPNG = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (!isPNG) {
            setError('Solo se admiten imágenes PNG. Exporta tu diseño con transparencia para obtener el mejor resultado.');
            return;
        }

        setError(null);
        setSelectedFile(file);
        setSvgOutput(null);
        setOptimizationInfo(null);
        setGt7Validation(null);
        setIsProcessing(true);
        setProcessingStep('Cargando imagen...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            await processImageAutomatic(e.target.result, file);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    };

    // Drag & drop handlers
    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const processImageAutomatic = async (imageDataUrl, originalFile) => {
        try {
            // Paso 1: Detectar y eliminar fondo si es necesario
            setProcessingStep('Detectando fondo...');
            const cleanedUrl = await removeBackgroundIfNeeded(imageDataUrl);

            // Paso 2: Optimizar tamaño y calidad
            setProcessingStep('Optimizando imagen...');
            const optimizedUrl = await optimizeImageSmart(cleanedUrl, originalFile);

            // Paso 3: Convertir a SVG automáticamente
            setProcessingStep('Convirtiendo a SVG...');
            await convertToSVGAutomatic(optimizedUrl);

        } catch (err) {
            console.error('Error en procesamiento automático:', err);
            setError('Error al procesar la imagen: ' + err.message);
            setIsProcessing(false);
        }
    };

    // Detectar si la imagen tiene fondo sólido y eliminarlo automáticamente
    const removeBackgroundIfNeeded = async (imageDataUrl) => {
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
                const w = canvas.width;
                const h = canvas.height;

                // Muestrear píxeles de los 4 bordes completos para detectar color de fondo
                const borderPixels = [];
                for (let x = 0; x < w; x++) {
                    // Top row
                    const iTop = (0 * w + x) * 4;
                    borderPixels.push({ r: data[iTop], g: data[iTop + 1], b: data[iTop + 2], a: data[iTop + 3] });
                    // Bottom row
                    const iBot = ((h - 1) * w + x) * 4;
                    borderPixels.push({ r: data[iBot], g: data[iBot + 1], b: data[iBot + 2], a: data[iBot + 3] });
                }
                for (let y = 1; y < h - 1; y++) {
                    // Left col
                    const iLeft = (y * w + 0) * 4;
                    borderPixels.push({ r: data[iLeft], g: data[iLeft + 1], b: data[iLeft + 2], a: data[iLeft + 3] });
                    // Right col
                    const iRight = (y * w + (w - 1)) * 4;
                    borderPixels.push({ r: data[iRight], g: data[iRight + 1], b: data[iRight + 2], a: data[iRight + 3] });
                }

                // Verificar si ya tiene transparencia (PNG sin fondo)
                const transparentBorderPixels = borderPixels.filter(p => p.a < 128);
                if (transparentBorderPixels.length > borderPixels.length * 0.5) {
                    // Ya tiene transparencia, no necesita eliminación de fondo
                    console.log('Imagen ya tiene fondo transparente, saltando eliminación.');
                    resolve(imageDataUrl);
                    return;
                }

                // Encontrar color dominante en bordes (probable fondo)
                const colorCounts = new Map();
                for (const p of borderPixels) {
                    if (p.a < 128) continue;
                    // Cuantizar a buckets de 16 para agrupar variaciones
                    const key = `${Math.floor(p.r / 16) * 16},${Math.floor(p.g / 16) * 16},${Math.floor(p.b / 16) * 16}`;
                    if (!colorCounts.has(key)) {
                        colorCounts.set(key, { count: 0, sumR: 0, sumG: 0, sumB: 0 });
                    }
                    const entry = colorCounts.get(key);
                    entry.count++;
                    entry.sumR += p.r; entry.sumG += p.g; entry.sumB += p.b;
                }

                // Obtener colores de fondo más probables ordenados
                let candidateColors = Array.from(colorCounts.values())
                    .map(entry => ({
                        r: Math.round(entry.sumR / entry.count),
                        g: Math.round(entry.sumG / entry.count),
                        b: Math.round(entry.sumB / entry.count),
                        count: entry.count
                    }))
                    .sort((a, b) => b.count - a.count);

                let bgColors = [];
                let totalBgCount = 0;

                // Permitimos hasta 2 colores principales (útil para fondos de "cuadros falsos" de PNG no transparentes)
                if (candidateColors.length > 0 && candidateColors[0].count > borderPixels.length * 0.15) {
                    bgColors.push(candidateColors[0]);
                    totalBgCount += candidateColors[0].count;
                    if (candidateColors.length > 1 && candidateColors[1].count > borderPixels.length * 0.15) {
                        bgColors.push(candidateColors[1]);
                        totalBgCount += candidateColors[1].count;
                    }
                }

                // Si los colores elegidos no llegan al 40% combinado del borde, probablemente no hay fondo uniforme
                if (totalBgCount < borderPixels.length * 0.4) {
                    console.log('No se detectó fondo uniforme, saltando eliminación.');
                    resolve(imageDataUrl);
                    return;
                }

                console.log(`Fondo detectado: ${bgColors.length} colores, cubriendo ${(totalBgCount / borderPixels.length * 100).toFixed(1)}% de bordes`);
                setProcessingStep(`Eliminando fondo (detectados ${bgColors.length} tonos)...`);

                // Eliminar fondo usando flood-fill desde los bordes
                // Esto es más preciso que eliminar por color global, ya que solo quita
                // el fondo conectado a los bordes (no elimina colores internos similares)
                const visited = new Uint8Array(w * h);
                const toRemove = new Uint8Array(w * h);
                const bgThreshold = 60; // Distancia máxima al color de fondo (un poco más permisivo para ruido/compresión)

                // Función auxiliar para comprobar si un píxel coincide con algún color de fondo
                const isBgColor = (r, g, b) => {
                    for (let i = 0; i < bgColors.length; i++) {
                        const bg = bgColors[i];
                        const dist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
                        if (dist < bgThreshold) return true;
                    }
                    return false;
                };

                // Usar Int32Array como cola circular para BFS eficiente O(n)
                // (queue.shift() en Array normal es O(n) → haría el BFS O(n²))
                const queue = new Int32Array(w * h);
                let qHead = 0;
                let qTail = 0;

                // Iniciar flood-fill desde todos los píxeles de borde que coincidan con el fondo
                for (let x = 0; x < w; x++) {
                    for (const y of [0, h - 1]) {
                        const idx = y * w + x;
                        const i = idx * 4;
                        if (data[i + 3] >= 128 && isBgColor(data[i], data[i + 1], data[i + 2])) {
                            queue[qTail++] = idx;
                            visited[idx] = 1;
                        }
                    }
                }
                for (let y = 1; y < h - 1; y++) {
                    for (const x of [0, w - 1]) {
                        const idx = y * w + x;
                        const i = idx * 4;
                        if (data[i + 3] >= 128 && isBgColor(data[i], data[i + 1], data[i + 2])) {
                            queue[qTail++] = idx;
                            visited[idx] = 1;
                        }
                    }
                }

                // BFS flood-fill con cola O(1) por operación
                while (qHead < qTail) {
                    const idx = queue[qHead++];
                    toRemove[idx] = 1;
                    const x = idx % w;
                    const y = Math.floor(idx / w);

                    // 4 vecinos (arriba, abajo, izquierda, derecha)
                    const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
                    const valid = [x > 0, x < w - 1, y > 0, y < h - 1];

                    for (let n = 0; n < 4; n++) {
                        if (!valid[n]) continue;
                        const nIdx = neighbors[n];
                        if (visited[nIdx]) continue;
                        visited[nIdx] = 1;
                        const ni = nIdx * 4;
                        if (data[ni + 3] < 128) continue; // Ya transparente

                        if (isBgColor(data[ni], data[ni + 1], data[ni + 2])) {
                            queue[qTail++] = nIdx;
                        }
                    }
                }

                // Aplicar transparencia y suavizar bordes
                let removedCount = 0;
                for (let idx = 0; idx < w * h; idx++) {
                    if (toRemove[idx]) {
                        const i = idx * 4;
                        data[i + 3] = 0; // Transparente
                        removedCount++;
                    }
                }

                // Suavizar bordes: píxeles adyacentes a los eliminados con semi-transparencia
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        if (toRemove[idx]) continue;
                        const i = idx * 4;
                        if (data[i + 3] < 128) continue;

                        // Contar vecinos eliminados
                        let removedNeighbors = 0;
                        if (toRemove[idx - 1]) removedNeighbors++;
                        if (toRemove[idx + 1]) removedNeighbors++;
                        if (toRemove[idx - w]) removedNeighbors++;
                        if (toRemove[idx + w]) removedNeighbors++;

                        if (removedNeighbors >= 2) {
                            // Semitransparencia en bordes para suavizar transición
                            data[i + 3] = Math.round(data[i + 3] * 0.6);
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                console.log(`Fondo eliminado: ${removedCount} píxeles (${(removedCount / (w * h) * 100).toFixed(1)}%)`);
                resolve(canvas.toDataURL('image/png'));
            };

            img.src = imageDataUrl;
        });
    };

    const optimizeImageSmart = async (imageDataUrl, originalFile) => {
        return new Promise((resolve) => {
            const img = new window.Image();

            img.onload = () => {
                const fitInside = (sourceWidth, sourceHeight, maxSize) => {
                    let fittedWidth = sourceWidth;
                    let fittedHeight = sourceHeight;

                    if (fittedWidth > maxSize || fittedHeight > maxSize) {
                        const aspectRatio = fittedWidth / fittedHeight;

                        if (fittedWidth > fittedHeight) {
                            fittedWidth = maxSize;
                            fittedHeight = maxSize / aspectRatio;
                        } else {
                            fittedHeight = maxSize;
                            fittedWidth = maxSize * aspectRatio;
                        }
                    }

                    return {
                        width: Math.round(fittedWidth),
                        height: Math.round(fittedHeight)
                    };
                };

                const buildScaledCanvas = (maxSize, smoothingEnabled) => {
                    const { width, height } = fitInside(img.width, img.height, maxSize);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    canvas.width = width;
                    canvas.height = height;
                    ctx.imageSmoothingEnabled = smoothingEnabled;
                    if (smoothingEnabled) {
                        ctx.imageSmoothingQuality = 'high';
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    return { canvas, ctx, width, height };
                };

                // Preview en alta calidad para no degradar visualmente la interfaz.
                const previewResult = buildScaledCanvas(400, true);
                // Analizar primero en una resolución intermedia para decidir un tamaño inicial inteligente.
                const analysisResult = buildScaledCanvas(220, true);
                const analyzedImageData = analysisResult.ctx.getImageData(0, 0, analysisResult.width, analysisResult.height);
                const complexity = analyzeImageComplexity(analyzedImageData);

                let conversionMaxSize = 188;
                if (complexity.complexity === 'muy_compleja') {
                    conversionMaxSize = 140;
                } else if (complexity.complexity === 'compleja') {
                    conversionMaxSize = 156;
                } else if (complexity.complexity === 'media') {
                    conversionMaxSize = 172;
                }

                const conversionResult = buildScaledCanvas(conversionMaxSize, true);

                previewResult.canvas.toBlob(
                    (previewBlob) => {
                        if (previewBlob) {
                            setOptimizedPreview(URL.createObjectURL(previewBlob));
                        }

                        conversionResult.canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    resolve(imageDataUrl);
                                    return;
                                }

                                const optimizedUrl = URL.createObjectURL(blob);
                                const originalSize = originalFile.size;
                                const optimizedSize = blob.size;
                                const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

                                // Analizar el lienzo real usado para la conversión sin sobrescribir la recomendación inicial.
                                const finalImageData = conversionResult.ctx.getImageData(0, 0, conversionResult.width, conversionResult.height);

                                let hasTransparency = false;
                                for (let pi = 3; pi < finalImageData.data.length; pi += 4) {
                                    if (finalImageData.data[pi] < 255) { hasTransparency = true; break; }
                                }

                                setOptimizationInfo({
                                    originalSize: (originalSize / 1024).toFixed(2),
                                    optimizedSize: (optimizedSize / 1024).toFixed(2),
                                    reduction: reduction,
                                    dimensions: `${conversionResult.width}x${conversionResult.height}`,
                                    backgroundRemoved: hasTransparency,
                                    complexity: complexity.complexity,
                                    colors: complexity.colorCount,
                                    recommendedConversionSize: conversionMaxSize
                                });

                                resolve(optimizedUrl);
                            },
                            'image/png',
                            0.9
                        );
                    },
                    'image/png',
                    0.95
                );
            };

            img.src = imageDataUrl;
        });
    };

    const convertWithImageTracer = async (imageData, width, height, profile = {}) => {
        const paletteLimit = profile.paletteLimit || 10;
        const candidateColors = getUniqueColors(imageData)
            .slice(0, Math.max(32, paletteLimit * 6));

        const rgbToHsl = (r, g, b) => {
            const rn = r / 255;
            const gn = g / 255;
            const bn = b / 255;
            const max = Math.max(rn, gn, bn);
            const min = Math.min(rn, gn, bn);
            const delta = max - min;
            let hue = 0;

            if (delta !== 0) {
                if (max === rn) hue = ((gn - bn) / delta) % 6;
                else if (max === gn) hue = (bn - rn) / delta + 2;
                else hue = (rn - gn) / delta + 4;
                hue *= 60;
                if (hue < 0) hue += 360;
            }

            const lightness = (max + min) / 2;
            const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
            return { h: hue, s: saturation, l: lightness };
        };

        const groups = {
            black: [],
            white: [],
            gray: [],
            red: [],
            darkred: [],
            orange: [],
            yellow: [],
            blue: [],
            darkblue: [],
            other: []
        };

        for (const color of candidateColors) {
            const hsl = rgbToHsl(color.r, color.g, color.b);
            if (hsl.l < 0.16) groups.black.push(color);
            else if (hsl.s < 0.16 && hsl.l > 0.82) groups.white.push(color);
            else if (hsl.s < 0.18) groups.gray.push(color);
            else if ((hsl.h >= 345 || hsl.h < 15) && hsl.l < 0.45) groups.darkred.push(color);
            else if (hsl.h >= 345 || hsl.h < 15) groups.red.push(color);
            else if (hsl.h >= 15 && hsl.h < 42) groups.orange.push(color);
            else if (hsl.h >= 42 && hsl.h < 72) groups.yellow.push(color);
            else if (hsl.h >= 200 && hsl.h < 250 && hsl.l < 0.45) groups.darkblue.push(color);
            else if (hsl.h >= 190 && hsl.h < 255) groups.blue.push(color);
            else groups.other.push(color);
        }

        const palette = [];
        const addPaletteColor = (color) => {
            if (!color || palette.length >= paletteLimit) return;

            const isDistinct = palette.every(existing => {
                const dr = existing.r - color.r;
                const dg = existing.g - color.g;
                const db = existing.b - color.b;
                return Math.sqrt(dr * dr + dg * dg + db * db) >= 24;
            });

            if (isDistinct) {
                palette.push({ r: color.r, g: color.g, b: color.b, a: 255 });
            }
        };

        const pickBest = (items, extraScore = () => 0) => items
            .slice()
            .sort((a, b) => (b.count + extraScore(b)) - (a.count + extraScore(a)))[0];

        addPaletteColor(pickBest(groups.black));
        addPaletteColor(pickBest(groups.white));
        addPaletteColor(pickBest(groups.red, (color) => rgbToHsl(color.r, color.g, color.b).s * 80));
        addPaletteColor(pickBest(groups.darkred, (color) => rgbToHsl(color.r, color.g, color.b).s * 60));
        addPaletteColor(pickBest(groups.orange, (color) => rgbToHsl(color.r, color.g, color.b).s * 60));
        addPaletteColor(pickBest(groups.yellow, (color) => rgbToHsl(color.r, color.g, color.b).s * 60));
        addPaletteColor(pickBest(groups.blue, (color) => rgbToHsl(color.r, color.g, color.b).s * 60));
        addPaletteColor(pickBest(groups.darkblue, (color) => rgbToHsl(color.r, color.g, color.b).s * 40));
        addPaletteColor(pickBest(groups.gray));

        [...groups.other, ...candidateColors].forEach(addPaletteColor);

        if (palette.length === 0) {
            candidateColors.slice(0, paletteLimit).forEach(addPaletteColor);
        }

        const sentinelCandidates = [
            { r: 0, g: 255, b: 0, a: 255 },
            { r: 255, g: 0, b: 255, a: 255 },
            { r: 0, g: 255, b: 255, a: 255 },
            { r: 255, g: 255, b: 0, a: 255 },
            { r: 255, g: 0, b: 128, a: 255 }
        ];

        const getMinDistance = (candidate) => {
            if (palette.length === 0) return Infinity;
            return Math.min(...palette.map(color => {
                const dr = candidate.r - color.r;
                const dg = candidate.g - color.g;
                const db = candidate.b - color.b;
                return Math.sqrt(dr * dr + dg * dg + db * db);
            }));
        };

        const sentinelColor = sentinelCandidates
            .map(candidate => ({ candidate, score: getMinDistance(candidate) }))
            .sort((a, b) => b.score - a.score)[0].candidate;

        const getDistance = (r, g, b, color) => {
            const dr = r - color.r;
            const dg = g - color.g;
            const db = b - color.b;
            return (dr * dr * 0.299) + (dg * dg * 0.587) + (db * db * 0.114);
        };

        const pixelIndexes = new Int16Array(width * height);
        const tracedData = new Uint8ClampedArray(imageData.data.length);
        for (let pi = 0; pi < width * height; pi++) {
            const i = pi * 4;
            if (imageData.data[i + 3] < 128) {
                tracedData[i] = sentinelColor.r;
                tracedData[i + 1] = sentinelColor.g;
                tracedData[i + 2] = sentinelColor.b;
                tracedData[i + 3] = 255;
                pixelIndexes[pi] = -1;
                continue;
            }

            let nearest = 0;
            let minDistance = Infinity;
            for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex++) {
                const distance = getDistance(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], palette[paletteIndex]);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = paletteIndex;
                }
            }

            pixelIndexes[pi] = nearest;
        }

        const smoothedIndexes = new Int16Array(pixelIndexes);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const pi = y * width + x;
                if (pixelIndexes[pi] < 0) continue;

                const votes = new Map();
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const neighborIndex = pixelIndexes[(y + oy) * width + (x + ox)];
                        if (neighborIndex < 0) continue;
                        votes.set(neighborIndex, (votes.get(neighborIndex) || 0) + 1);
                    }
                }

                let bestIndex = pixelIndexes[pi];
                let bestVotes = 0;
                votes.forEach((voteCount, candidateIndex) => {
                    if (voteCount > bestVotes) {
                        bestVotes = voteCount;
                        bestIndex = candidateIndex;
                    }
                });

                if (bestVotes >= 5) {
                    smoothedIndexes[pi] = bestIndex;
                }
            }
        }

        for (let pi = 0; pi < width * height; pi++) {
            const i = pi * 4;
            if (smoothedIndexes[pi] < 0) {
                tracedData[i] = sentinelColor.r;
                tracedData[i + 1] = sentinelColor.g;
                tracedData[i + 2] = sentinelColor.b;
                tracedData[i + 3] = 255;
            } else {
                const color = palette[smoothedIndexes[pi]];
                tracedData[i] = color.r;
                tracedData[i + 1] = color.g;
                tracedData[i + 2] = color.b;
                tracedData[i + 3] = 255;
            }
        }

        const tracedImageData = new ImageData(tracedData, width, height);
        const tracerOptions = {
            ltres: profile.ltres ?? 0.8,
            qtres: profile.qtres ?? 0.8,
            pathomit: profile.pathomit ?? 1,
            rightangleenhance: true,
            colorsampling: 0,
            numberofcolors: palette.length + 1,
            mincolorratio: profile.mincolorratio ?? 0,
            colorquantcycles: profile.colorquantcycles ?? 1,
            layering: 0,
            strokewidth: 0,
            linefilter: profile.linefilter ?? false,
            scale: 1,
            roundcoords: 1,
            viewbox: true,
            desc: false,
            blurradius: profile.blurradius ?? 0,
            blurdelta: profile.blurdelta ?? 20,
            pal: [sentinelColor, ...palette]
        };

        let svg = ImageTracer.imagedataToSVG(tracedImageData, tracerOptions);
        const sentinelFill = `rgb(${sentinelColor.r},${sentinelColor.g},${sentinelColor.b})`;
        const sentinelHex = `#${sentinelColor.r.toString(16).padStart(2, '0')}${sentinelColor.g.toString(16).padStart(2, '0')}${sentinelColor.b.toString(16).padStart(2, '0')}`;
        const shortSentinelHex = sentinelHex[1] === sentinelHex[2] && sentinelHex[3] === sentinelHex[4] && sentinelHex[5] === sentinelHex[6]
            ? `#${sentinelHex[1]}${sentinelHex[3]}${sentinelHex[5]}`
            : null;

        svg = svg.replace(new RegExp(`<path[^>]*fill="${sentinelFill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\/?>`, 'gi'), '');
        svg = svg.replace(new RegExp(`<path[^>]*fill="${sentinelHex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\/?>`, 'gi'), '');
        if (shortSentinelHex) {
            svg = svg.replace(new RegExp(`<path[^>]*fill="${shortSentinelHex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\/?>`, 'gi'), '');
        }

        return svg;
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

                    const drawToCanvas = (targetWidth, targetHeight) => {
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                        return ctx.getImageData(0, 0, targetWidth, targetHeight);
                    };

                    const conversionProfiles = [
                        { scale: 1.00, paletteLimit: 10, pathomit: 0, ltres: 0.5, qtres: 0.5, linefilter: false, blurradius: 0, colorquantcycles: 1 },
                        { scale: 0.92, paletteLimit: 9, pathomit: 0, ltres: 0.8, qtres: 0.8, linefilter: false, blurradius: 0, colorquantcycles: 1 },
                        { scale: 0.84, paletteLimit: 8, pathomit: 1, ltres: 1.0, qtres: 1.0, linefilter: false, blurradius: 0, colorquantcycles: 1 },
                        { scale: 0.76, paletteLimit: 7, pathomit: 2, ltres: 1.5, qtres: 1.5, linefilter: true, blurradius: 0, colorquantcycles: 1 },
                        { scale: 0.68, paletteLimit: 6, pathomit: 3, ltres: 2.0, qtres: 2.0, linefilter: true, blurradius: 0, colorquantcycles: 1 }
                    ];

                    let svg = null;
                    let size = Infinity;
                    let attempts = 0;
                    let currentWidth = img.width;
                    let currentHeight = img.height;
                    let chosenProfile = null;
                    let bestAttempt = null;
                    const triedProfiles = new Set();

                    for (const profile of conversionProfiles) {
                        const nextWidth = Math.max(72, Math.floor(img.width * profile.scale));
                        const nextHeight = Math.max(72, Math.floor(img.height * profile.scale));
                        const profileKey = `${nextWidth}x${nextHeight}-${profile.paletteLimit}-${profile.pathomit}-${profile.ltres}-${profile.qtres}`;

                        if (triedProfiles.has(profileKey)) {
                            continue;
                        }
                        triedProfiles.add(profileKey);

                        attempts++;
                        currentWidth = nextWidth;
                        currentHeight = nextHeight;
                        setProcessingStep(`Convirtiendo a SVG... intento ${attempts}/${conversionProfiles.length}`);

                        const imageData = drawToCanvas(currentWidth, currentHeight);
                        let rawSvg;

                        try {
                            rawSvg = await convertWithImageTracer(imageData, currentWidth, currentHeight, profile);
                        } catch (imageTracerError) {
                            console.warn('ImageTracer falló, usando fallback Potrace:', imageTracerError);
                            rawSvg = await convertWithMultipleLayers(
                                imageData,
                                currentWidth,
                                currentHeight,
                                threshold,
                                turdSize,
                                profile
                            );
                        }

                        const candidateSvg = optimizeSvg(rawSvg);
                        const candidateSize = new Blob([candidateSvg], { type: 'image/svg+xml' }).size;

                        if (!bestAttempt || candidateSize < bestAttempt.size) {
                            bestAttempt = {
                                svg: candidateSvg,
                                size: candidateSize,
                                width: currentWidth,
                                height: currentHeight,
                                profile
                            };
                        }

                        if (candidateSize <= 15 * 1024) {
                            svg = candidateSvg;
                            size = candidateSize;
                            chosenProfile = profile;
                            break;
                        }
                    }

                    if (!svg && bestAttempt) {
                        size = bestAttempt.size;
                        currentWidth = bestAttempt.width;
                        currentHeight = bestAttempt.height;
                        chosenProfile = bestAttempt.profile;
                    }

                    setFileSize(size);

                    if (size > 15 * 1024) {
                        setError(`La imagen es muy compleja. Tamaño final: ${(size / 1024).toFixed(2)} KB. Usa Modo Avanzado para ajustar parámetros.`);
                        setIsProcessing(false);
                        setProcessingStep('');
                        reject(new Error('SVG demasiado grande'));
                    } else {
                        // Aplicar optimización SVG avanzada
                        const compressedSvg = svg;
                        const compressedSize = size;

                        console.log('Peso final del SVG:', (compressedSize / 1024).toFixed(2), 'KB');

                        // Contar capas SVG
                        const svgLayers = (compressedSvg.match(/<path/g) || []).length;

                        setSvgOutput(compressedSvg);

                        // Validar conformidad GT7
                        const validation = validateGT7Compliance(compressedSvg, compressedSize);
                        setGt7Validation(validation);

                        setOptimizationInfo(prev => ({
                            ...prev,
                            svgSize: (compressedSize / 1024).toFixed(2),
                            compressionGain: ((size - compressedSize) / size * 100).toFixed(1),
                            finalDimensions: currentWidth !== img.width ? `${currentWidth}x${currentHeight}` : null,
                            attempts,
                            svgLayers,
                            finalPalette: chosenProfile?.paletteLimit || null
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
                // Buckets de 16 para diferenciar mejor entre colores cercanos
                const qr = Math.floor(r / 16) * 16;
                const qg = Math.floor(g / 16) * 16;
                const qb = Math.floor(b / 16) * 16;
                const colorKey = `${qr},${qg},${qb}`;

                if (!colorMap.has(colorKey)) {
                    colorMap.set(colorKey, { count: 0, sumR: 0, sumG: 0, sumB: 0 });
                }
                const entry = colorMap.get(colorKey);
                entry.count++;
                entry.sumR += r; entry.sumG += g; entry.sumB += b;
            }
        }

        // Usar color promedio real del bucket (no el cuantizado)
        let colors = Array.from(colorMap.entries())
            .map(([key, data]) => ({
                r: Math.round(data.sumR / data.count),
                g: Math.round(data.sumG / data.count),
                b: Math.round(data.sumB / data.count),
                rgb: `rgb(${Math.round(data.sumR / data.count)},${Math.round(data.sumG / data.count)},${Math.round(data.sumB / data.count)})`,
                count: data.count
            }))
            .sort((a, b) => b.count - a.count);

        // Fusionar colores perceptualmente cercanos (distancia euclidiana < 30)
        const merged = [];
        const used = new Set();
        for (let i = 0; i < colors.length; i++) {
            if (used.has(i)) continue;
            let c = { ...colors[i] };
            let totalCount = c.count;
            let sumR = c.r * c.count, sumG = c.g * c.count, sumB = c.b * c.count;

            for (let j = i + 1; j < colors.length; j++) {
                if (used.has(j)) continue;
                const dist = Math.sqrt(
                    (c.r - colors[j].r) ** 2 + (c.g - colors[j].g) ** 2 + (c.b - colors[j].b) ** 2
                );
                if (dist < 30) {
                    sumR += colors[j].r * colors[j].count;
                    sumG += colors[j].g * colors[j].count;
                    sumB += colors[j].b * colors[j].count;
                    totalCount += colors[j].count;
                    used.add(j);
                }
            }

            const avgR = Math.round(sumR / totalCount);
            const avgG = Math.round(sumG / totalCount);
            const avgB = Math.round(sumB / totalCount);
            merged.push({
                r: avgR, g: avgG, b: avgB,
                rgb: `rgb(${avgR},${avgG},${avgB})`,
                count: totalCount
            });
            used.add(i);
        }

        return merged.sort((a, b) => b.count - a.count);
    };

    // Simplificar colores: algoritmo Median-Cut para mejor representación de paleta
    const simplifyColors = (imageData, maxColors = 16) => {
        const { data, width, height } = imageData;
        const newData = new Uint8ClampedArray(data);

        // Recolectar todos los píxeles opacos con su índice
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] >= 128) {
                pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], idx: i });
            }
        }

        if (pixels.length === 0) return new ImageData(newData, width, height);

        // Algoritmo Median-Cut: divide recursivamente el espacio de color
        const medianCut = (pixelList, depth) => {
            if (depth === 0 || pixelList.length === 0) {
                // Calcular color promedio del bucket
                const avg = { r: 0, g: 0, b: 0 };
                for (const p of pixelList) {
                    avg.r += p.r; avg.g += p.g; avg.b += p.b;
                }
                avg.r = Math.round(avg.r / pixelList.length);
                avg.g = Math.round(avg.g / pixelList.length);
                avg.b = Math.round(avg.b / pixelList.length);
                return [{ color: avg, pixels: pixelList }];
            }

            // Encontrar el canal de color con mayor rango
            let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
            for (const p of pixelList) {
                if (p.r < minR) minR = p.r; if (p.r > maxR) maxR = p.r;
                if (p.g < minG) minG = p.g; if (p.g > maxG) maxG = p.g;
                if (p.b < minB) minB = p.b; if (p.b > maxB) maxB = p.b;
            }

            const rangeR = maxR - minR;
            const rangeG = maxG - minG;
            const rangeB = maxB - minB;

            let sortChannel;
            if (rangeR >= rangeG && rangeR >= rangeB) sortChannel = 'r';
            else if (rangeG >= rangeR && rangeG >= rangeB) sortChannel = 'g';
            else sortChannel = 'b';

            // Ordenar por el canal con mayor rango y dividir en la mediana
            pixelList.sort((a, b) => a[sortChannel] - b[sortChannel]);
            const mid = Math.floor(pixelList.length / 2);

            return [
                ...medianCut(pixelList.slice(0, mid), depth - 1),
                ...medianCut(pixelList.slice(mid), depth - 1)
            ];
        };

        const depth = Math.ceil(Math.log2(maxColors));
        const buckets = medianCut(pixels, depth);

        // Limpiar píxeles transparentes
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) {
                newData[i] = 0; newData[i + 1] = 0; newData[i + 2] = 0; newData[i + 3] = 0;
            }
        }

        // Asignar a cada píxel el color promedio de su bucket
        for (const bucket of buckets) {
            const c = bucket.color;
            for (const p of bucket.pixels) {
                newData[p.idx] = c.r;
                newData[p.idx + 1] = c.g;
                newData[p.idx + 2] = c.b;
                // Mantener alpha original
            }
        }

        return new ImageData(newData, width, height);
    };

    const convertWithMultipleLayers = async (imageData, width, height, threshold, turdSize, profile = {}) => {
        try {
            // SVG header con version="1.1" requerido por GT7
            const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
            const svgFooter = '</svg>';

            // ═══════════════════════════════════════════════════════════════
            // PASO 1: Extraer paleta con bucketing agresivo + merge,
            // luego asignar cada píxel al color más cercano (Voronoi).
            // Produce regiones limpias sin anti-aliasing fragmentado.
            // ═══════════════════════════════════════════════════════════════
            const imgData = imageData.data;
            const totalPixels = imgData.length / 4;

            // 1a. Agrupar colores en buckets grandes (32 niveles por canal)
            const cMap = new Map();
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i + 3] < 128) continue;
                const key = `${Math.floor(imgData[i] / 32) * 32},${Math.floor(imgData[i + 1] / 32) * 32},${Math.floor(imgData[i + 2] / 32) * 32}`;
                if (!cMap.has(key)) cMap.set(key, { count: 0, sR: 0, sG: 0, sB: 0 });
                const e = cMap.get(key);
                e.count++; e.sR += imgData[i]; e.sG += imgData[i + 1]; e.sB += imgData[i + 2];
            }
            let bColors = Array.from(cMap.values())
                .map(d => ({ r: Math.round(d.sR / d.count), g: Math.round(d.sG / d.count), b: Math.round(d.sB / d.count), count: d.count }))
                .sort((a, b) => b.count - a.count);

            // 1b. Merge colores cercanos (distancia euclidiana < 45)
            const mergedArr = [];
            const usedSet = new Set();
            for (let i = 0; i < bColors.length; i++) {
                if (usedSet.has(i)) continue;
                let sR = bColors[i].r * bColors[i].count, sG = bColors[i].g * bColors[i].count, sB = bColors[i].b * bColors[i].count, tot = bColors[i].count;
                for (let j = i + 1; j < bColors.length; j++) {
                    if (usedSet.has(j)) continue;
                    const dr = bColors[i].r - bColors[j].r, dg = bColors[i].g - bColors[j].g, db = bColors[i].b - bColors[j].b;
                    if (Math.sqrt(dr * dr + dg * dg + db * db) < 45) {
                        sR += bColors[j].r * bColors[j].count; sG += bColors[j].g * bColors[j].count; sB += bColors[j].b * bColors[j].count;
                        tot += bColors[j].count; usedSet.add(j);
                    }
                }
                const r = Math.round(sR / tot), g = Math.round(sG / tot), b = Math.round(sB / tot);
                mergedArr.push({ r, g, b, rgb: `rgb(${r},${g},${b})`, count: tot });
                usedSet.add(i);
            }
            const maxPaletteColors = profile.paletteLimit || (width <= 100 && height <= 100 ? 16 : 12);
            const palette = mergedArr.sort((a, b) => b.count - a.count).slice(0, maxPaletteColors);
            console.log(`Paleta: ${palette.length} colores`);
            palette.forEach((c, i) => console.log(`  [${i}] ${c.rgb} — ${c.count} px`));

            const getColorMetrics = (r, g, b) => {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const chroma = Math.max(r, g, b) - Math.min(r, g, b);
                return { luminance, chroma };
            };

            const darkLumaThreshold = profile.darkLumaThreshold || (width <= 100 && height <= 100 ? 92 : 84);
            const darkChromaThreshold = profile.darkChromaThreshold || 76;
            const lightLumaThreshold = profile.lightLumaThreshold || (width <= 100 && height <= 100 ? 190 : 205);
            const lightChromaThreshold = profile.lightChromaThreshold || 92;
            const isDarkContourPixel = (r, g, b) => {
                const { luminance, chroma } = getColorMetrics(r, g, b);
                return luminance < darkLumaThreshold && (chroma < darkChromaThreshold || luminance < 42);
            };
            const isDarkContourColor = (color) => isDarkContourPixel(color.r, color.g, color.b);
            const isLightFillPixel = (r, g, b) => {
                const { luminance, chroma } = getColorMetrics(r, g, b);
                return luminance > lightLumaThreshold && chroma < lightChromaThreshold && Math.min(r, g, b) > 150;
            };
            const isLightFillColor = (color) => isLightFillPixel(color.r, color.g, color.b);

            // 1c. Asignación Voronoi: cada píxel → color de paleta más cercano
            const assignments = new Uint8Array(totalPixels);
            const colorCounts = new Array(palette.length).fill(0);
            for (let i = 0; i < imgData.length; i += 4) {
                const pi = i >> 2;
                if (imgData[i + 3] < 128) { assignments[pi] = 255; continue; }
                let minD = Infinity, nearest = 0;
                for (let p = 0; p < palette.length; p++) {
                    const dr = imgData[i] - palette[p].r, dg = imgData[i + 1] - palette[p].g, db = imgData[i + 2] - palette[p].b;
                    // Dar más peso al brillo (luma) para que no junte colores de diferente brillo
                    const d2 = (dr * dr * 0.299) + (dg * dg * 0.587) + (db * db * 0.114);
                    if (d2 < minD) { minD = d2; nearest = p; }
                }
                assignments[pi] = nearest;
                colorCounts[nearest]++;
            }

            // ═══════════════════════════════════════════════════════════════
            // PASO 2: Extraer paths de SVG generado por Potrace (robust)
            // ═══════════════════════════════════════════════════════════════
            const extractPathsFromSvg = (svg) => {
                const paths = [];
                let m;
                // Patrón 1: d antes de fill
                const regex1 = /<path[^>]*?\bd="([^"]+)"[^>]*?\bfill="([^"]*)"[^>]*?\/?>/gi;
                while ((m = regex1.exec(svg)) !== null) {
                    if (m[1] && m[1].trim() && m[1].trim() !== 'M0 0') paths.push({ d: m[1], fill: m[2] });
                }
                if (paths.length > 0) return paths;
                // Patrón 2: fill antes de d
                const regex2 = /<path[^>]*?\bfill="([^"]*)"[^>]*?\bd="([^"]+)"[^>]*?\/?>/gi;
                while ((m = regex2.exec(svg)) !== null) {
                    if (m[2] && m[2].trim() && m[2].trim() !== 'M0 0') paths.push({ d: m[2], fill: m[1] });
                }
                if (paths.length > 0) return paths;
                // Patrón 3: solo d (último recurso)
                const regex3 = /<path[^>]*?\bd="([^"]+)"[^>]*?\/?>/gi;
                while ((m = regex3.exec(svg)) !== null) {
                    if (m[1] && m[1].trim() && m[1].trim() !== 'M0 0') paths.push({ d: m[1], fill: '' });
                }
                return paths;
            };

            // Trazar máscara con Potrace
            const traceMask = (maskCanvas, fillColor, overrides = {}) => {
                return new Promise((resolve) => {
                    maskCanvas.toBlob((blob) => {
                        if (!blob) return resolve(null);
                        const reader = new FileReader();
                        reader.onerror = () => resolve(null);
                        reader.onload = () => {
                            try {
                                const buffer = Buffer.from(reader.result);
                                Potrace.trace(buffer, {
                                    threshold: 128, // La máscara es blanco y negro puro, con 128 lee todo
                                    turdSize: Math.max(turdSize, overrides.traceTurdFloor ?? profile.traceTurdFloor ?? 0),
                                    optTolerance: overrides.traceTolerance ?? profile.traceTolerance ?? 0.7,
                                    alphaMax: 1.0,
                                    color: fillColor,
                                    background: 'transparent',
                                    turnPolicy: overrides.turnPolicy ?? 'minority'
                                }, (err, svg) => {
                                    if (err || !svg) return resolve(null);
                                    const paths = extractPathsFromSvg(svg);
                                    if (paths.length > 0) {
                                        const combinedD = paths.map(p => p.d).join(' ');
                                        resolve({ d: combinedD, fill: fillColor });
                                    } else {
                                        resolve(null);
                                    }
                                });
                            } catch (e) {
                                resolve(null);
                            }
                        };
                        reader.readAsArrayBuffer(blob);
                    }, 'image/png');
                });
            };

            // ═══════════════════════════════════════════════════════════════
            // PASO 3: Para cada color, crear máscara binaria desde Voronoi
            // y trazar con Potrace. Máscaras no se solapan.
            // ═══════════════════════════════════════════════════════════════
            let svgPaths = [];

            const minPixelsPerColor = profile.minPixelsPerColor || (width <= 100 && height <= 100 ? 2 : 5);

            const buildMaskCanvas = (predicate) => {
                const maskCanvas = document.createElement('canvas');
                const maskCtx = maskCanvas.getContext('2d');
                maskCanvas.width = width;
                maskCanvas.height = height;
                const maskData = maskCtx.createImageData(width, height);
                let pixelCount = 0;

                for (let pi = 0; pi < totalPixels; pi++) {
                    const j = pi * 4;
                    if (predicate(pi, j)) {
                        maskData.data[j] = 0;
                        maskData.data[j + 1] = 0;
                        maskData.data[j + 2] = 0;
                        maskData.data[j + 3] = 255;
                        pixelCount++;
                    } else {
                        maskData.data[j] = 255;
                        maskData.data[j + 1] = 255;
                        maskData.data[j + 2] = 255;
                        maskData.data[j + 3] = 255;
                    }
                }

                maskCtx.putImageData(maskData, 0, 0);
                return { maskCanvas, pixelCount };
            };

            // Pasada 1: rellenos claros unificados para conservar el banner y reflejos.
            const lightMask = buildMaskCanvas((pi, j) => imgData[j + 3] >= 128 && isLightFillPixel(imgData[j], imgData[j + 1], imgData[j + 2]));
            if (lightMask.pixelCount >= Math.max(10, Math.floor(totalPixels * 0.01))) {
                const tracedLight = await traceMask(lightMask.maskCanvas, '#fff', {
                    traceTolerance: Math.max(0.58, (profile.traceTolerance ?? 0.7) - 0.05),
                    traceTurdFloor: 0,
                    turnPolicy: 'white'
                });
                if (tracedLight && tracedLight.d) {
                    svgPaths.push(`<path d="${tracedLight.d}" fill="#fff" fill-rule="evenodd"/>`);
                    console.log(`✓ Capa rellenos claros: ${lightMask.pixelCount} px añadida`);
                }
            }

            // Pasada 1: contornos y masas oscuras como una sola capa para evitar perforaciones.
            const contourMask = buildMaskCanvas((pi, j) => imgData[j + 3] >= 128 && isDarkContourPixel(imgData[j], imgData[j + 1], imgData[j + 2]));
            let contourPath = null;

            if (contourMask.pixelCount >= Math.max(12, Math.floor(totalPixels * 0.01))) {
                const tracedContour = await traceMask(contourMask.maskCanvas, '#000', {
                    traceTolerance: Math.max(0.55, (profile.traceTolerance ?? 0.7) - 0.08),
                    traceTurdFloor: 0,
                    turnPolicy: 'minority'
                });

                if (tracedContour && tracedContour.d) {
                    contourPath = `<path d="${tracedContour.d}" fill="#000" fill-rule="evenodd"/>`;
                    console.log(`✓ Capa contornos oscuros: ${contourMask.pixelCount} px añadida`);
                }
            }

            for (let p = 0; p < palette.length; p++) {
                if (isDarkContourColor(palette[p])) {
                    console.log(`Saltando ${palette[p].rgb}: resuelto en pasada de contornos`);
                    continue;
                }

                if (isLightFillColor(palette[p])) {
                    console.log(`Saltando ${palette[p].rgb}: resuelto en pasada de rellenos claros`);
                    continue;
                }

                if (colorCounts[p] < minPixelsPerColor) {
                    console.log(`Saltando ${palette[p].rgb}: solo ${colorCounts[p]} px`);
                    continue;
                }

                const maskCanvas = document.createElement('canvas');
                const maskCtx = maskCanvas.getContext('2d');
                maskCanvas.width = width;
                maskCanvas.height = height;
                const maskData = maskCtx.createImageData(width, height);

                for (let pi = 0; pi < totalPixels; pi++) {
                    const j = pi * 4;
                    if (
                        assignments[pi] === p &&
                        !isDarkContourPixel(imgData[j], imgData[j + 1], imgData[j + 2]) &&
                        !isLightFillPixel(imgData[j], imgData[j + 1], imgData[j + 2])
                    ) {
                        maskData.data[j] = 0; maskData.data[j + 1] = 0;
                        maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                    } else {
                        maskData.data[j] = 255; maskData.data[j + 1] = 255;
                        maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                    }
                }
                maskCtx.putImageData(maskData, 0, 0);

                const traced = await traceMask(maskCanvas, palette[p].rgb);
                if (!traced || !traced.d || !traced.d.trim()) {
                    console.log(`Sin resultado para ${palette[p].rgb}`);
                    continue;
                }

                const newPath = `<path d="${traced.d}" fill="${palette[p].rgb}" fill-rule="evenodd"/>`;
                svgPaths.push(newPath);
                console.log(`✓ Capa ${p}: ${palette[p].rgb}, ${colorCounts[p]} px añadida`);
            }

            if (contourPath) {
                svgPaths.push(contourPath);
            }

            console.log(`Total capas: ${svgPaths.length} de ${palette.length} colores`);

            // Fallback: silueta si nada se trazó
            if (svgPaths.length === 0) {
                console.log('Ninguna capa trazada. Generando silueta.');
                const maskCanvas = document.createElement('canvas');
                const maskCtx = maskCanvas.getContext('2d');
                maskCanvas.width = width; maskCanvas.height = height;
                const maskData = maskCtx.createImageData(width, height);
                for (let pi = 0; pi < totalPixels; pi++) {
                    const j = pi * 4;
                    if (assignments[pi] !== 255) {
                        maskData.data[j] = 0; maskData.data[j + 1] = 0; maskData.data[j + 2] = 0; maskData.data[j + 3] = 255;
                    } else {
                        maskData.data[j] = 255; maskData.data[j + 1] = 255; maskData.data[j + 2] = 255; maskData.data[j + 3] = 255;
                    }
                }
                maskCtx.putImageData(maskData, 0, 0);
                const dominant = getDominantColor(imageData);
                const traced = await traceMask(maskCanvas, dominant);
                if (traced && traced.d) {
                    svgPaths.push(`<path d="${traced.d}" fill="${dominant}" fill-rule="evenodd"/>`);
                }
            }

            return svgHeader + svgPaths.join('') + svgFooter;
        } catch (err) {
            throw err;
        }
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
        // Revocar objectURLs para liberar memoria
        if (optimizedPreview && optimizedPreview.startsWith('blob:')) {
            URL.revokeObjectURL(optimizedPreview);
        }
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
        setGt7Validation(null);
        setDragActive(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getSvgPreviewMarkup = (svgString) => {
        if (!svgString) return '';

        return svgString
            .replace(/\swidth="[^"]*"/i, '')
            .replace(/\sheight="[^"]*"/i, '')
            .replace(
                /<svg([^>]*)>/i,
                '<svg$1 preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;">'
            );
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
                            Herramientas GT7 Championships
                        </span>
                    </h1>
                    <p className="text-xl text-gray-300">
                        Herramientas útiles para el equipo GT7 Championships
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

                        {/* File Upload con Drag & Drop */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2 text-orange-300">
                                Seleccionar Imagen (PNG)
                            </label>
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => !isProcessing && fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                                    ${dragActive
                                        ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
                                        : 'border-white/30 hover:border-orange-500/50 hover:bg-white/5'
                                    }
                                    ${isProcessing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png"
                                    onChange={handleFileSelect}
                                    disabled={isProcessing}
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center gap-3">
                                    <span className="text-5xl">{dragActive ? '📥' : '🖼️'}</span>
                                    <p className="text-white font-medium text-lg">
                                        {dragActive ? 'Suelta la imagen aquí' : 'Arrastra y suelta tu imagen PNG aquí'}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        o haz clic para seleccionar archivo
                                    </p>
                                    <span className="text-xs text-gray-500 mt-1">
                                        Solo archivos PNG • El SVG resultante no superará 15 kB
                                    </span>
                                </div>
                            </div>
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
                                <div className="relative w-full h-80 rounded-lg overflow-hidden" style={{ backgroundImage: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%)', backgroundSize: '16px 16px' }}>
                                    <div
                                        className="w-full h-full flex items-center justify-center p-4"
                                        dangerouslySetInnerHTML={{ __html: getSvgPreviewMarkup(svgOutput) }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Validación de conformidad GT7 */}
                        {gt7Validation && svgOutput && !isProcessing && (
                            <div className={`mt-6 p-4 rounded-lg border ${gt7Validation.allPass
                                ? 'bg-green-900/20 border-green-500/30'
                                : 'bg-red-900/20 border-red-500/30'
                                }`}>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    {gt7Validation.allPass ? '✅' : '⚠️'} Conformidad GT7
                                </h3>
                                <p className="text-sm text-gray-400 mb-3">
                                    Verificación automática según los{' '}
                                    <a href="https://www.gran-turismo.com/es/gt7/manual/liveryeditor/06"
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-orange-400 hover:text-orange-300 underline">
                                        requisitos oficiales de GT7
                                    </a>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {gt7Validation.checks.map((check, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="flex-shrink-0">{check.pass ? '✅' : '❌'}</span>
                                            <span className={check.pass ? 'text-green-400' : 'text-red-400'}>
                                                {check.label}
                                            </span>
                                            <span className="text-gray-500 text-xs">({check.detail})</span>
                                        </div>
                                    ))}
                                </div>
                                {gt7Validation.allPass && (
                                    <p className="mt-3 text-sm text-green-400 font-medium">
                                        🏎️ Listo para subir a gran-turismo.com → Mi Página → Cargador de vinilo
                                    </p>
                                )}
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
                                    <li><strong>Simplifica colores (Median-Cut):</strong> Reduce la paleta usando cuantización adaptativa que preserva mejor los tonos representativos</li>
                                    <li><strong>Analiza complejidad:</strong> Evalúa colores, bordes y detalles para optimizar parámetros automáticamente</li>
                                    <li><strong>Vectoriza en múltiples capas:</strong> Crea SVG multicapa con Potrace priorizando formas principales y detalles pequeños</li>
                                    <li><strong>Optimiza SVG:</strong> Compacta coordenadas, elimina atributos redundantes y reduce precisión decimal</li>
                                    <li><strong>Valida conformidad GT7:</strong> Verifica version SVG 1.1, tamaño ≤15 kB, sin bitmaps ni modos de mezcla</li>
                                </ol>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Requisitos de GT7 para vinilos SVG:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Tamaño máximo de archivo: <strong>15 kB</strong></li>
                                    <li>Versión SVG: <strong>1.0 o 1.1</strong></li>
                                    <li>Sin modos de mezcla (multiplicar, pantalla, superponer, etc.)</li>
                                    <li>Sin mapas de bits incrustados</li>
                                    <li>Textos deben estar convertidos a contornos (paths)</li>
                                    <li><a href="https://www.gran-turismo.com/es/gt7/manual/liveryeditor/06" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">Ver manual oficial completo</a></li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-orange-400">Consejos para mejores resultados:</h3>
                                <ul className="list-disc list-inside space-y-1 ml-4">
                                    <li>Usa imágenes PNG <strong>sin fondo</strong> con colores sólidos y bordes definidos</li>
                                    <li>Los logos y gráficos simples producen SVGs más fieles y eficientes</li>
                                    <li>Imágenes entre 200–500px de ancho dan el mejor balance calidad/tamaño</li>
                                    <li>Evita texturas complejas, gradientes y ruido — las formas geométricas se vectorizan mejor</li>
                                    <li>Puedes usar el Modo Avanzado para ajustar threshold y turd size si el resultado no es óptimo</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
