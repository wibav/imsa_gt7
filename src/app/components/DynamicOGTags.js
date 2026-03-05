"use client";
import { useEffect } from "react";

/**
 * Inyecta dinámicamente meta tags de Open Graph para compartir en redes sociales.
 * Funciona con static export — los crawlers que ejecutan JS (Discord, Telegram, etc.) verán los tags.
 * Para crawlers sin JS (Facebook, Twitter básico) se usará la metadata por defecto del layout.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.image] - URL absoluta de la imagen
 * @param {string} [props.url] - URL canónica de la página
 * @param {string} [props.type] - Tipo OG (default: 'article')
 */
export default function DynamicOGTags({ title, description, image, url, type = "article" }) {
    useEffect(() => {
        if (!title) return;

        const setMetaTag = (property, content) => {
            if (!content) return;
            let tag = document.querySelector(`meta[property="${property}"]`);
            if (!tag) {
                tag = document.createElement("meta");
                tag.setAttribute("property", property);
                document.head.appendChild(tag);
            }
            tag.setAttribute("content", content);
        };

        const setMetaName = (name, content) => {
            if (!content) return;
            let tag = document.querySelector(`meta[name="${name}"]`);
            if (!tag) {
                tag = document.createElement("meta");
                tag.setAttribute("name", name);
                document.head.appendChild(tag);
            }
            tag.setAttribute("content", content);
        };

        // Update page title
        document.title = `${title} | GT7 Championship`;

        // Open Graph
        setMetaTag("og:title", title);
        setMetaTag("og:type", type);
        if (description) setMetaTag("og:description", description);
        if (image) setMetaTag("og:image", image);
        if (url) setMetaTag("og:url", url);

        // Twitter Card
        setMetaName("twitter:card", image ? "summary_large_image" : "summary");
        setMetaName("twitter:title", title);
        if (description) setMetaName("twitter:description", description);
        if (image) setMetaName("twitter:image", image);
    }, [title, description, image, url, type]);

    return null;
}
