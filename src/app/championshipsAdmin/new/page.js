"use client";

import { Suspense } from 'react';
import ChampionshipForm from '../../components/championship/ChampionshipForm';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

function NewChampionshipContent() {
    return <ChampionshipForm isEditing={false} />;
}

export default function NewChampionship() {
    return (
        <Suspense fallback={<LoadingSkeleton variant="page" message="Cargando..." />}>
            <NewChampionshipContent />
        </Suspense>
    );
}
