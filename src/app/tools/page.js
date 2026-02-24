'use client';

import { useState, useRef, useCallback } from 'react';
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

        // 3. Optimizar path data (la mayor fuente de ahorro)
        svg = svg.replace(/ d="([^"]+)"/g, (match, pathData) => {
            let d = pathData;
            // Eliminar espacios redundantes
            d = d.replace(/\s+/g, ' ').trim();
            // Eliminar espacio después de comandos SVG
            d = d.replace(/([MLHVCSQTAZ])\s+/gi, '$1');
            // Usar signo negativo como separador implícito: "10 -5" → "10-5"
            d = d.replace(/(\d)\s+(-)/g, '$1$2');
            // Redondear a 1 decimal
            d = d.replace(/(\d+\.\d{2,})/g, (m) => parseFloat(m).toFixed(1));
            // Eliminar .0 innecesarios: "10.0" → "10"
            d = d.replace(/(\d+)\.0(?=[^.\d]|$)/g, '$1');
            // Eliminar ceros iniciales: "0.5" → ".5"
            d = d.replace(/\b0+(\.[\d]+)/g, '$1');
            return ` d="${d}"`;
        });

        // 4. Eliminar atributos innecesarios
        svg = svg.replace(/\s+stroke="none"/gi, '');
        svg = svg.replace(/\s+fill-opacity="1"/gi, '');
        svg = svg.replace(/\s+stroke-opacity="1"/gi, '');
        svg = svg.replace(/\s+opacity="1"/gi, '');
        svg = svg.replace(/\s+stroke-width="0"/gi, '');

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

                // Obtener color de fondo más probable
                let bgColor = null;
                let maxCount = 0;
                colorCounts.forEach((entry) => {
                    if (entry.count > maxCount) {
                        maxCount = entry.count;
                        bgColor = {
                            r: Math.round(entry.sumR / entry.count),
                            g: Math.round(entry.sumG / entry.count),
                            b: Math.round(entry.sumB / entry.count)
                        };
                    }
                });

                // Si menos del 40% de los bordes comparten el mismo color, probablemente no hay fondo uniforme
                if (!bgColor || maxCount < borderPixels.length * 0.4) {
                    console.log('No se detectó fondo uniforme, saltando eliminación.');
                    resolve(imageDataUrl);
                    return;
                }

                console.log(`Fondo detectado: rgb(${bgColor.r},${bgColor.g},${bgColor.b}) — ${maxCount}/${borderPixels.length} píxeles de borde`);
                setProcessingStep(`Eliminando fondo rgb(${bgColor.r},${bgColor.g},${bgColor.b})...`);

                // Eliminar fondo usando flood-fill desde los bordes
                // Esto es más preciso que eliminar por color global, ya que solo quita
                // el fondo conectado a los bordes (no elimina colores internos similares)
                const visited = new Uint8Array(w * h);
                const toRemove = new Uint8Array(w * h);
                const bgThreshold = 50; // Distancia máxima al color de fondo

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
                        const dist = Math.sqrt((data[i] - bgColor.r) ** 2 + (data[i + 1] - bgColor.g) ** 2 + (data[i + 2] - bgColor.b) ** 2);
                        if (dist < bgThreshold && data[i + 3] >= 128) {
                            queue[qTail++] = idx;
                            visited[idx] = 1;
                        }
                    }
                }
                for (let y = 1; y < h - 1; y++) {
                    for (const x of [0, w - 1]) {
                        const idx = y * w + x;
                        const i = idx * 4;
                        const dist = Math.sqrt((data[i] - bgColor.r) ** 2 + (data[i + 1] - bgColor.g) ** 2 + (data[i + 2] - bgColor.b) ** 2);
                        if (dist < bgThreshold && data[i + 3] >= 128) {
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
                        const dist = Math.sqrt((data[ni] - bgColor.r) ** 2 + (data[ni + 1] - bgColor.g) ** 2 + (data[ni + 2] - bgColor.b) ** 2);
                        if (dist < bgThreshold) {
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
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                // Ajuste inteligente de tamaño: escalar proporcionalmente
                // Imágenes grandes se reducen más, pequeñas se preservan
                let maxSize;
                if (width > 1000 || height > 1000) {
                    maxSize = 250; // Imágenes muy grandes: reducir agresivamente
                } else if (width > 500 || height > 500) {
                    maxSize = 350; // Imágenes medianas
                } else {
                    maxSize = Math.max(width, height); // Pequeñas: mantener tamaño original
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

                        // Detectar si el fondo fue eliminado (hay píxeles transparentes)
                        let hasTransparency = false;
                        for (let pi = 3; pi < finalImageData.data.length; pi += 4) {
                            if (finalImageData.data[pi] < 255) { hasTransparency = true; break; }
                        }

                        setOptimizationInfo({
                            originalSize: (originalSize / 1024).toFixed(2),
                            optimizedSize: (optimizedSize / 1024).toFixed(2),
                            reduction: reduction,
                            dimensions: `${Math.round(width)}x${Math.round(height)}`,
                            backgroundRemoved: hasTransparency,
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
                        // Aplicar optimización SVG avanzada
                        const compressedSvg = optimizeSvg(svg);
                        const compressedSize = new Blob([compressedSvg], { type: 'image/svg+xml' }).size;

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
                // Buckets de 24 para agrupar variaciones del mismo tono (gradientes, anti-alias)
                const qr = Math.floor(r / 24) * 24;
                const qg = Math.floor(g / 24) * 24;
                const qb = Math.floor(b / 24) * 24;
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

        // Fusionar colores perceptualmente cercanos (distancia euclidiana < 50)
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
                if (dist < 50) {
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

    const convertWithMultipleLayers = async (imageData, width, height, threshold, turdSize) => {
        try {
            const totalPixels = width * height;
            const uniqueColors = getUniqueColors(imageData)
                .slice(0, 300);
            console.log(`La imagen tiene ${uniqueColors.length} capas de color`);

            let svgPathsByColor = new Map();
            let currentSize = 0;
            const maxSize = 15 * 1024; // 15KB

            const reserveBytes = 3.5 * 1024;
            const usableBudgetFirstPass = Math.max(4 * 1024, maxSize - reserveBytes);

            // SVG header con version="1.1" requerido por GT7
            const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
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
                        if (!blob) return resolvePath(null);
                        const reader = new FileReader();
                        reader.onerror = () => resolvePath(null);
                        reader.onload = () => {
                            try {
                                const buffer = Buffer.from(reader.result);
                                Potrace.trace(buffer, opts, (err, svg) => {
                                    if (err) return rejectPath(err);
                                    if (!svg) return resolvePath(null);
                                    const pathMatch = svg.match(/<path[^>]*d="([^"]*)"[^>]*fill="([^"]*)"[^>]*\/>/);
                                    if (pathMatch) resolvePath({ d: pathMatch[1], fill: pathMatch[2], raw: svg });
                                    else resolvePath(null);
                                });
                            } catch (e) {
                                console.error('Error en traceMaskCanvas:', e);
                                resolvePath(null);
                            }
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

                // Tolerancia adaptiva: pocos colores → tolerancia alta, muchos → baja
                const adaptiveTolerance = uniqueColors.length <= 8 ? 40
                    : uniqueColors.length <= 16 ? 30
                        : uniqueColors.length <= 30 ? 20
                            : 12;
                let pixelCount = 0;

                for (let j = 0; j < data.length; j += 4) {
                    const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                    // Usar distancia euclidiana para mejor matching perceptual
                    const dist = Math.sqrt((r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2);
                    const matches = a >= 128 && dist <= adaptiveTolerance;
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
                // Tolerancia adaptiva para secundarias (un poco más estricta)
                const secTolerance = uniqueColors.length <= 8 ? 35
                    : uniqueColors.length <= 16 ? 25
                        : uniqueColors.length <= 30 ? 16
                            : 10;
                let pixelCount = 0;
                for (let j = 0; j < data.length; j += 4) {
                    const r = data[j]; const g = data[j + 1]; const b = data[j + 2]; const a = data[j + 3];
                    const dist = Math.sqrt((r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2);
                    const matches = a >= 128 && dist <= secTolerance;
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

            return finalSvg;
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
                                <div className="relative w-full h-64 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                                    <div
                                        className="w-full h-full flex items-center justify-center p-4"
                                        dangerouslySetInnerHTML={{ __html: svgOutput }}
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
