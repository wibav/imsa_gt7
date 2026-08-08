"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { plainTextToRegulationsHtml, regulationsByteSize, REGULATIONS_MAX_BYTES } from '../../utils/regulations';
import { sanitizeRegulationsHtml } from '../../utils/regulationsSanitize';

/**
 * Editor WYSIWYG del reglamento de campeonato (Tiptap v3).
 * Debe montarse SIEMPRE con next/dynamic({ ssr: false }) desde el caller.
 *
 * @param {{ value: string, format: 'html'|'plain'|null, onChange: (html: string) => void, maxBytes?: number }} props
 */
export default function RegulationsEditor({ value, format, onChange, maxBytes = REGULATIONS_MAX_BYTES }) {
    const initialContent = format === 'html' ? (value || '') : plainTextToRegulationsHtml(value || '');

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [3, 4] },
                codeBlock: false,
                code: false,
                blockquote: false,
                horizontalRule: false,
                strike: false,
                link: {
                    openOnClick: false,
                    autolink: true,
                    protocols: ['http', 'https', 'mailto'],
                    HTMLAttributes: {
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    }
                }
            })
        ],
        content: initialContent,
        editorProps: {
            attributes: {
                class: 'regulations-rich regulations-rich--editor focus:outline-none'
            },
            transformPastedHTML: (html) => sanitizeRegulationsHtml(html)
        },
        onUpdate: ({ editor: ed }) => {
            onChange?.(ed.getHTML());
        }
    });

    if (!editor) {
        return <div className="regulations-rich regulations-rich--editor animate-pulse h-40" />;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href || '';
        const url = window.prompt('URL del enlace (http://, https:// o mailto:)', previousUrl);
        if (url === null) return;

        if (url.trim() === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        if (!/^(?:https?:|mailto:)/i.test(url.trim())) {
            window.alert('Solo se permiten enlaces http://, https:// o mailto:');
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    };

    const bytes = regulationsByteSize(editor.getHTML());
    const kb = (bytes / 1024).toFixed(1);
    const maxKb = (maxBytes / 1024).toFixed(0);
    const ratio = bytes / maxBytes;
    const counterColor = ratio > 1 ? 'text-red-400' : ratio >= 0.8 ? 'text-amber-400' : 'text-gray-400';

    const ToolbarButton = ({ onClick, active, label, children }) => (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
        >
            {children}
        </button>
    );

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                <ToolbarButton
                    label="Negrita"
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    <strong>B</strong>
                </ToolbarButton>
                <ToolbarButton
                    label="Cursiva"
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <em>I</em>
                </ToolbarButton>
                <ToolbarButton
                    label="Subrayado"
                    active={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                    <span className="underline">U</span>
                </ToolbarButton>
                <ToolbarButton
                    label="Título H3"
                    active={editor.isActive('heading', { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    H3
                </ToolbarButton>
                <ToolbarButton
                    label="Título H4"
                    active={editor.isActive('heading', { level: 4 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                >
                    H4
                </ToolbarButton>
                <ToolbarButton
                    label="Lista de viñetas"
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    •≡
                </ToolbarButton>
                <ToolbarButton
                    label="Lista numerada"
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    1≡
                </ToolbarButton>
                <ToolbarButton
                    label="Insertar enlace"
                    active={editor.isActive('link')}
                    onClick={setLink}
                >
                    🔗
                </ToolbarButton>
                <ToolbarButton
                    label="Quitar formato"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                >
                    ✕
                </ToolbarButton>
            </div>

            <EditorContent editor={editor} />

            <p className={`text-xs mt-2 ${counterColor}`}>
                {kb} KB / {maxKb} KB
                {ratio > 1 && ' — el reglamento supera el máximo permitido, reduce el contenido'}
            </p>
        </div>
    );
}
