// Textos compartidos por varias páginas públicas.
const comun = {
    es: {
        estado: {
            active: 'Activo', draft: 'Borrador', completed: 'Finalizado', archived: 'Archivado',
            upcoming: 'Próximo', live: 'EN VIVO', 'in-progress': 'En Progreso',
            pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
        },
        carga: {
            lenta: 'Está tardando más de lo normal. Puede ser la conexión.',
            reintentar: 'Volver a cargar',
        },
        error: {
            titulo: 'Algo no ha cargado bien',
            texto: 'Suele arreglarse volviendo a cargar la página. Si se repite, avisa a la organización.',
        },
    },
    en: {
        estado: {
            active: 'Active', draft: 'Draft', completed: 'Finished', archived: 'Archived',
            upcoming: 'Upcoming', live: 'LIVE', 'in-progress': 'In progress',
            pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
        },
        carga: {
            lenta: 'This is taking longer than usual. It may be the connection.',
            reintentar: 'Reload',
        },
        error: {
            titulo: 'Something did not load properly',
            texto: 'Reloading the page usually fixes it. If it happens again, let the organisers know.',
        },
    },
    pt: {
        estado: {
            active: 'Ativo', draft: 'Rascunho', completed: 'Terminado', archived: 'Arquivado',
            upcoming: 'Próximo', live: 'EM DIRETO', 'in-progress': 'A decorrer',
            pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado',
        },
        carga: {
            lenta: 'Está a demorar mais do que o normal. Pode ser a ligação.',
            reintentar: 'Recarregar',
        },
        error: {
            titulo: 'Algo não carregou bem',
            texto: 'Normalmente resolve-se recarregando a página. Se voltar a acontecer, avise a organização.',
        },
    },
};

export default comun;
