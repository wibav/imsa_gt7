"use client";
import { useEffect, useState } from "react";
import { getTeams } from "../firebase/services";

export default function Dashboard() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        onGetTeams();
    }, []);

    const onGetTeams = async () => {
        console.log("Fetching teams...");
        setLoading(true);
        try {
            const data = await getTeams();
            console.log("getTeams Resp: ", data);
            setTeams(data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching teams:", error);
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8">Cargando equipos...</div>;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Dashboard de Equipos</h1>
            {teams.map((team) => (
                <div key={team.id} className="mb-6 border p-4 rounded">
                    <h2 className="text-xl font-semibold mb-2">{team.name}</h2>
                    <div className="ml-4">
                        <h3 className="font-semibold">Pilotos:</h3>
                        <ul>
                            {team.drivers.map((driver, idx) => (
                                <li key={idx} className="mb-1">
                                    <span className="font-bold">{driver.name}</span> ({driver.category}) - Puntos: {driver.points ? driver.points.join(", ") : "0"} | Total: {driver.total}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="mt-2 font-bold text-blue-700">
                        Total equipo: {team.total}
                    </div>
                </div>
            ))}
        </div>
    );
}