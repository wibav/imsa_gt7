"use client";
import { useEffect, useState } from "react";
import { getTeams, saveTeams } from "../../firebase/services";

// Ejemplo de datos iniciales (puedes cargarlos desde Firestore)
const initialTeams = [
    {
        "id": 1,
        "name": "Equipo 1",
        "color": "green",
        "drivers": [
            { "name": "YECHE", "category": "Gr1", "points": [9, 15, 13, 14], "total": 51 },
            { "name": "NANO", "category": "Gr2", "points": [10, 9, 9, 9], "total": 37 },
            { "name": "JORGE", "category": "Gr3", "points": [6, 6, 5, 5], "total": 22 },
            { "name": "DANI", "category": "Gr4", "points": [2, 3, 3, 2], "total": 10 }
        ],
        "total": 120
    },
    {
        "id": 2,
        "name": "Equipo 2",
        "color": "red",
        "drivers": [
            { "name": "MISIL", "category": "Gr1", "points": [11, 16, 14, 10], "total": 51 },
            { "name": "CHELIOS", "category": "Gr2", "points": [12, 10, 11, 11], "total": 44 },
            { "name": "LUYAN", "category": "Gr3", "points": [7, 8, 7, 7], "total": 29 },
            { "name": "DESH", "category": "Gr4", "points": [3, 2, 2, 1], "total": 8 }
        ],
        "total": 132
    },
    {
        "id": 3,
        "name": "Equipo 3",
        "color": "yellow",
        "drivers": [
            { "name": "VAZQUEZ", "category": "Gr1", "points": [15, 13, 15, 15], "total": 58 },
            { "name": "HOLO", "category": "Gr2", "points": [13, 12, 12, 12], "total": 49 },
            { "name": "SERRANO", "category": "Gr3", "points": [5, 5, 6, 6], "total": 22 },
            { "name": "CHIKY", "category": "Gr4", "points": [4, 4, 4, 3], "total": 15 }
        ],
        "total": 144
    },
    {
        "id": 4,
        "name": "Equipo 4",
        "color": "orange",
        "drivers": [
            { "name": "OJER", "category": "Gr1", "points": [16, 14, 16, 16], "total": 62 },
            { "name": "SEGURATA", "category": "Gr2", "points": [14, 11, 10, 13], "total": 48 },
            { "name": "NICO", "category": "Gr3", "points": [8, 7, 8, 8], "total": 31 },
            { "name": "TONY", "category": "Gr4", "points": [1, 1, 1, 4], "total": 7 }
        ],
        "total": 148
    }
]

export default function TeamsAdminPage() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTeams().then(data => {
            setTeams(data);
            setLoading(false);
        });
    }, []);

    // Actualiza el nombre del equipo
    const handleTeamNameChange = (idx, value) => {
        const updated = [...teams];
        updated[idx].name = value;
        setTeams(updated);
    };

    // Actualiza el nombre de un piloto
    const handleDriverNameChange = (teamIdx, driverIdx, value) => {
        const updated = [...teams];
        updated[teamIdx].drivers[driverIdx].name = value;
        setTeams(updated);
    };

    // Guarda los equipos en Firestore
    const handleSave = async () => {
        await saveTeams(teams);
        alert("Equipos guardados en Firebase");
    };

    if (loading) return <div className="p-8">Cargando equipos...</div>;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Administrar Equipos</h1>
            {teams.map((team, idx) => (
                <div key={team.id} className="mb-6 border p-4 rounded">
                    <label className="block font-semibold">Nombre del equipo:</label>
                    <input
                        className="border p-2 mb-2 w-full"
                        value={team.name}
                        onChange={e => handleTeamNameChange(idx, e.target.value)}
                    />
                    <div className="ml-4">
                        <label className="block font-semibold">Pilotos:</label>
                        {team.drivers.map((driver, dIdx) => (
                            <div key={dIdx} className="flex gap-2 mb-1">
                                <input
                                    className="border p-1"
                                    value={driver.name}
                                    onChange={e => handleDriverNameChange(idx, dIdx, e.target.value)}
                                />
                                <span className="text-gray-600">{driver.category}</span>
                                <span className="text-gray-600">Puntos: {driver.points.join(", ")}</span>
                                <span className="text-gray-600">Total: {driver.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-4 py-2 rounded"
            >
                Guardar Equipos en Firebase
            </button>
        </div>
    );
}