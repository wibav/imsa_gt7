"use client";

import { useMemo } from 'react';
import { sanitizeRegulationsHtml } from '../../utils/regulationsSanitize';

/**
 * Vista pública del reglamento de campeonato.
 * `dangerouslySetInnerHTML` debe existir SOLO en este archivo de todo el repo.
 *
 * @param {{ regulations: string|null, format: 'html'|'plain'|null }} props
 */
export default function RegulationsView({ regulations, format }) {
    const cleanHtml = useMemo(() => {
        if (format !== 'html') return '';
        return sanitizeRegulationsHtml(regulations || '');
    }, [regulations, format]);

    if (format !== 'html') {
        return <div className="text-gray-200 whitespace-pre-line text-sm leading-relaxed">{regulations}</div>;
    }

    return (
        <div
            className="regulations-rich text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
    );
}
