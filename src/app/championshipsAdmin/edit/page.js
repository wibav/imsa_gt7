"use client";

import { Suspense } from 'react';
import ChampionshipForm from '../../components/championship/ChampionshipForm';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ProtectedRoute from '../../components/ProtectedRoute';

function EditChampionshipContent() {
    return <ChampionshipForm isEditing={true} />;
}

export default function EditChampionship() {
    // Mismo guard que /championshipsAdmin/new — ver ese archivo (ADR-009).
    return (
        <ProtectedRoute requireAdmin>
            <Suspense fallback={<LoadingSkeleton variant="page" message="Cargando..." />}>
                <EditChampionshipContent />
            </Suspense>
        </ProtectedRoute>
    );
}
