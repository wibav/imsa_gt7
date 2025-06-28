import { NextResponse, NextRequest } from 'next/server'
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
import { app } from "../firebase/firebaseConfig";

const db = getFirestore(app);
export const dynamic = "force-static";

export async function GET(request) {
    try {
        const tracksCol = collection(db, "tracks");
        const trackSnapshot = await getDocs(tracksCol);
        const tracks = trackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(tracks);
    } catch (error) {
        console.log("Error fetching tracks: ", error);
        return NextResponse.json({ message: error.message }, { status: 400 });
    }
}

export async function POST(request) {
    const tracks = await request.json();
    console.log("Received tracks: ", tracks);
    try {
        const promises = tracks.map(track =>
            setDoc(doc(collection(db, "tracks"), String(track.id)), track)
        );
        await Promise.all(promises);
        return NextResponse.json({ message: "success" }, { status: 200 });
    } catch (error) {
        console.log("Error saving tracks: ", error);
        return NextResponse.json({ message: error.message }, { status: 400 });
    }
}