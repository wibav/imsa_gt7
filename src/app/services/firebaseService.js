import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { app } from "../api/firebase/firebaseConfig";

const db = getFirestore(app);

export class FirebaseService {
  // Obtener todos los equipos
  static async getTeams() {
    try {
      const teamsCol = collection(db, "teams");
      const teamSnapshot = await getDocs(teamsCol);
      const teams = teamSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return teams;
    } catch (error) {
      console.error("Error fetching teams: ", error);
      throw error;
    }
  }

  // Guardar equipos
  static async saveTeams(teams) {
    try {
      const promises = teams.map(team =>
        setDoc(doc(collection(db, "teams"), String(team.id)), team)
      );
      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      console.error("Error saving teams: ", error);
      throw error;
    }
  }

  // Obtener todas las pistas
  static async getTracks() {
    try {
      const tracksCol = collection(db, "tracks");
      const trackSnapshot = await getDocs(tracksCol);
      const tracks = trackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return tracks;
    } catch (error) {
      console.error("Error fetching tracks: ", error);
      throw error;
    }
  }

  // Guardar pistas
  static async saveTracks(tracks) {
    try {
      const promises = tracks.map(track =>
        setDoc(doc(collection(db, "tracks"), String(track.id)), track)
      );
      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      console.error("Error saving tracks: ", error);
      throw error;
    }
  }

  // Obtener todos los eventos especiales
  static async getEvents() {
    try {
      const eventsCol = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsCol);
      const events = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return events;
    } catch (error) {
      console.error("Error fetching events: ", error);
      throw error;
    }
  }

  // Guardar eventos especiales
  static async saveEvents(events) {
    try {
      const promises = events.map(event =>
        setDoc(doc(collection(db, "events"), String(event.id)), event)
      );
      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      console.error("Error saving events: ", error);
      throw error;
    }
  }

  // Eliminar un evento por id
  static async deleteEvent(eventId) {
    try {
      await deleteDoc(doc(collection(db, "events"), String(eventId)));
      return { success: true };
    } catch (error) {
      console.error("Error deleting event: ", error);
      throw error;
    }
  }
}