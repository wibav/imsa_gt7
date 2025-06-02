import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
import { app } from "./firebaseConfig";

const db = getFirestore(app);

export const getTeams = async () => {
    try {
        const teamsCol = collection(db, "teams");
        const teamSnapshot = await getDocs(teamsCol);
        return teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.log("Error fetching teams: ", error);
        return [];
    }
};

export const saveTeams = async (teams) => {
    try {
        const promises = teams.map(team =>
            setDoc(doc(collection(db, "teams"), String(team.id)), team)
        );
        await Promise.all(promises);
    } catch (error) {
        console.log("Error saving teams: ", error);
    }
};