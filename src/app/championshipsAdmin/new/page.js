"use client";

import { Suspense } from 'react';
import ChampionshipForm from '../../components/championship/ChampionshipForm';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ProtectedRoute from '../../components/ProtectedRoute';

function NewChampionshipContent() {
    return <ChampionshipForm isEditing={false} />;
}

export default function NewChampionship() {
    return (
        // Antes no tenía ningún guard de rol (solo ChampionshipForm chequea
        // currentUser) — cualquier usuario logueado, incluido un comisario,
        // podía abrir el formulario de creación (la escritura fallaba por
        // firestore.rules, pero el formulario era navegable). ADR-009.
        <ProtectedRoute requireAdmin>
            <Suspense fallback={<LoadingSkeleton variant="page" message="Cargando..." />}>
                <NewChampionshipContent />
            </Suspense>
        </ProtectedRoute>
    );
}
