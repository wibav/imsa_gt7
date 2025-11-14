import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { app } from "../api/firebase/firebaseConfig";
import { Championship, Team, Track, Event } from "../models/Championship";

const db = getFirestore(app);
const storage = getStorage(app);

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

  // ========================================
  // CHAMPIONSHIPS METHODS
  // ========================================

  /**
   * Obtener todos los campeonatos
   */
  static async getChampionships() {
    try {
      const championshipsCol = collection(db, "championships");
      const q = query(championshipsCol, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc =>
        Championship.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching championships:", error);
      throw error;
    }
  }

  /**
   * Obtener un campeonato por ID
   */
  static async getChampionship(championshipId) {
    try {
      const docRef = doc(db, "championships", championshipId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return Championship.fromFirestore(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error("Error fetching championship:", error);
      throw error;
    }
  }

  /**
   * Obtener campeonatos activos
   */
  static async getActiveChampionships() {
    try {
      const championshipsCol = collection(db, "championships");
      const q = query(
        championshipsCol,
        where("status", "==", "active"),
        orderBy("startDate", "desc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc =>
        Championship.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching active championships:", error);
      throw error;
    }
  }

  /**
   * Crear un nuevo campeonato
   */
  static async createChampionship(championshipData) {
    try {
      const championship = new Championship(championshipData);
      const validation = championship.validate();

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const docRef = await addDoc(
        collection(db, "championships"),
        championship.toFirestore()
      );

      return {
        success: true,
        id: docRef.id,
        championship: Championship.fromFirestore(docRef.id, championship.toFirestore())
      };
    } catch (error) {
      console.error("Error creating championship:", error);
      throw error;
    }
  }

  /**
   * Actualizar un campeonato
   */
  static async updateChampionship(championshipId, updates) {
    try {
      console.log('🔥 FirebaseService.updateChampionship recibió:');
      console.log('championshipId:', championshipId);
      console.log('updates:', JSON.stringify(updates, null, 2));
      console.log('updates.drivers:', updates.drivers);

      const docRef = doc(db, "championships", championshipId);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      console.log('🔥 Enviando a Firebase:', JSON.stringify(updateData, null, 2));

      await updateDoc(docRef, updateData);

      console.log('✅ Actualización exitosa en Firebase');

      return { success: true };
    } catch (error) {
      console.error("Error updating championship:", error);
      throw error;
    }
  }

  /**
   * Eliminar un campeonato
   */
  static async deleteChampionship(championshipId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting championship:", error);
      throw error;
    }
  }

  // ========================================
  // TEAMS METHODS (con championshipId)
  // ========================================

  /**
   * Obtener equipos de un campeonato
   */
  static async getTeamsByChampionship(championshipId) {
    try {
      const teamsCol = collection(db, "championships", championshipId, "teams");
      const snapshot = await getDocs(teamsCol);

      return snapshot.docs.map(doc =>
        Team.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw error;
    }
  }

  /**
   * Crear un equipo en un campeonato
   */
  static async createTeam(championshipId, teamData) {
    try {
      const team = new Team({ ...teamData, championshipId });
      const validation = team.validate();

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const docRef = await addDoc(
        collection(db, "championships", championshipId, "teams"),
        team.toFirestore()
      );

      return {
        success: true,
        id: docRef.id,
        team: Team.fromFirestore(docRef.id, team.toFirestore())
      };
    } catch (error) {
      console.error("Error creating team:", error);
      throw error;
    }
  }

  /**
   * Actualizar un equipo
   */
  static async updateTeam(championshipId, teamId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "teams", teamId);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);
      return { success: true };
    } catch (error) {
      console.error("Error updating team:", error);
      throw error;
    }
  }

  /**
   * Eliminar un equipo
   */
  static async deleteTeam(championshipId, teamId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId, "teams", teamId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting team:", error);
      throw error;
    }
  }

  // ========================================
  // TRACKS METHODS (con championshipId)
  // ========================================

  /**
   * Obtener pistas de un campeonato
   */
  static async getTracksByChampionship(championshipId) {
    try {
      const tracksCol = collection(db, "championships", championshipId, "tracks");
      const q = query(tracksCol, orderBy("round", "asc"));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc =>
        Track.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching tracks:", error);
      throw error;
    }
  }

  /**
   * Crear una pista en un campeonato
   */
  static async createTrack(championshipId, trackData) {
    try {
      const track = new Track({ ...trackData, championshipId });
      const validation = track.validate();

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const docRef = await addDoc(
        collection(db, "championships", championshipId, "tracks"),
        track.toFirestore()
      );

      return {
        success: true,
        id: docRef.id,
        track: Track.fromFirestore(docRef.id, track.toFirestore())
      };
    } catch (error) {
      console.error("Error creating track:", error);
      throw error;
    }
  }

  /**
   * Actualizar una pista
   */
  static async updateTrack(championshipId, trackId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "tracks", trackId);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);
      return { success: true };
    } catch (error) {
      console.error("Error updating track:", error);
      throw error;
    }
  }

  /**
   * Eliminar una pista
   */
  static async deleteTrack(championshipId, trackId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId, "tracks", trackId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting track:", error);
      throw error;
    }
  }

  // ========================================
  // EVENTS METHODS (con championshipId)
  // ========================================

  /**
   * Obtener eventos de un campeonato
   */
  static async getEventsByChampionship(championshipId) {
    try {
      const eventsCol = collection(db, "championships", championshipId, "events");
      const q = query(eventsCol, orderBy("date", "desc"));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc =>
        Event.fromFirestore(doc.id, doc.data())
      );
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  /**
   * Crear un evento en un campeonato
   */
  static async createEvent(championshipId, eventData) {
    try {
      const event = new Event({ ...eventData, championshipId });
      const validation = event.validate();

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const docRef = await addDoc(
        collection(db, "championships", championshipId, "events"),
        event.toFirestore()
      );

      return {
        success: true,
        id: docRef.id,
        event: Event.fromFirestore(docRef.id, event.toFirestore())
      };
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }

  /**
   * Actualizar un evento
   */
  static async updateEvent(championshipId, eventId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "events", eventId);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);
      return { success: true };
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  /**
   * Eliminar un evento de un campeonato
   */
  static async deleteEventFromChampionship(championshipId, eventId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId, "events", eventId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  // ========================================
  // FIREBASE STORAGE METHODS
  // ========================================

  /**
   * Subir una imagen a Firebase Storage
   * @param {File} file - Archivo de imagen
   * @param {string} path - Ruta en Storage (ej: "championships/champ123/banners/banner.jpg")
   * @returns {Promise<string>} URL de descarga de la imagen
   */
  static async uploadImage(file, path) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  }

  /**
   * Eliminar una imagen de Firebase Storage
   * @param {string} path - Ruta en Storage
   */
  static async deleteImage(path) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      console.error("Error deleting image:", error);
      throw error;
    }
  }

  /**
   * Obtener URL de una imagen desde Storage
   * @param {string} path - Ruta en Storage
   * @returns {Promise<string>} URL de descarga
   */
  static async getImageUrl(path) {
    try {
      const storageRef = ref(storage, path);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error("Error getting image URL:", error);
      throw error;
    }
  }
}