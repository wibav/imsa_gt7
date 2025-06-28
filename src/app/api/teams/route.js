import { NextResponse, NextRequest } from 'next/server'
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
import { app } from "../firebase/firebaseConfig";

const db = getFirestore(app);
export const dynamic = "force-static";

export async function GET(request) {
    try {
        const teamsCol = collection(db, "teams");
        const teamSnapshot = await getDocs(teamsCol);
        const teams = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(teams);
    } catch (error) {
        console.log("Error fetching teams: ", error);
        return NextResponse.json({ message: error.message }, { status: 400 });
    }
}

export async function POST(request) {
    const teams = await request.json();
    console.log("Received teams: ", teams);
    try {
        const promises = teams.map(team =>
            setDoc(doc(collection(db, "teams"), String(team.id)), team)
        );
        await Promise.all(promises);
        return NextResponse.json({ message: "success" }, { status: 200 });
    } catch (error) {
        console.log("Error saving teams: ", error);
        return NextResponse.json({ message: error.message }, { status: 400 });
    }
}