"use client";

import { Suspense } from 'react';
import ChampionshipForm from '../../components/championship/ChampionshipForm';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

function EditChampionshipContent() {
    return <ChampionshipForm isEditing={true} />;
}

export default function EditChampionship() {
    return (
        <Suspense fallback={<LoadingSkeleton variant="page" message="Cargando..." />}>
            <EditChampionshipContent />
        </Suspense>
    );
}
