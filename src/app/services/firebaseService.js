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
  arrayUnion,
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
import { Penalty, Claim } from "../models/Penalty";

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

  // Obtener un evento por ID - subcollections tienen prioridad, doc principal como fallback
  static async getEvent(eventId) {
    try {
      const eventRef = doc(db, "events", String(eventId));
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        return null;
      }

      const baseEventData = { id: eventSnap.id, ...eventSnap.data() };

      // Siempre intentar cargar subcollections (estructura nueva)
      const [participants, waitlist, results, rounds] = await Promise.all([
        this._loadEventParticipants(String(eventId)),
        this._loadEventWaitlist(String(eventId)),
        this._loadEventResults(String(eventId)),
        this._loadEventRounds(String(eventId))
      ]);

      // Subcollections tienen prioridad; si están vacías, usar el doc principal (estructura vieja)
      return {
        ...baseEventData,
        participants: participants.length > 0 ? participants : (baseEventData.participants || []),
        waitlist: waitlist.length > 0 ? waitlist : (baseEventData.waitlist || []),
        results: results.length > 0 ? results : (baseEventData.results || []),
        rounds: rounds.length > 0 ? rounds : (baseEventData.rounds || [])
      };
    } catch (error) {
      console.error("Error fetching event:", error);
      throw error;
    }
  }

  // Cargar participantes desde subcollection
  static async _loadEventParticipants(eventId) {
    try {
      const subcolRef = collection(db, "events", eventId, "participants");
      const snapshot = await getDocs(subcolRef);
      return snapshot.docs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(doc => doc.data());
    } catch (error) {
      console.error("Error loading participants:", error);
      return [];
    }
  }

  // Cargar lista de espera desde subcollection
  static async _loadEventWaitlist(eventId) {
    try {
      const subcolRef = collection(db, "events", eventId, "waitlist");
      const snapshot = await getDocs(subcolRef);
      return snapshot.docs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(doc => doc.data());
    } catch (error) {
      console.error("Error loading waitlist:", error);
      return [];
    }
  }

  // Cargar resultados desde subcollection
  static async _loadEventResults(eventId) {
    try {
      const subcolRef = collection(db, "events", eventId, "results");
      const snapshot = await getDocs(subcolRef);
      return snapshot.docs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(doc => doc.data());
    } catch (error) {
      console.error("Error loading results:", error);
      return [];
    }
  }

  // Cargar rondas desde subcollection
  static async _loadEventRounds(eventId) {
    try {
      const subcolRef = collection(db, "events", eventId, "rounds");
      const snapshot = await getDocs(subcolRef);
      return snapshot.docs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(doc => doc.data());
    } catch (error) {
      console.error("Error loading rounds:", error);
      return [];
    }
  }

  // Obtener todos los eventos especiales - SIN CARGAR DATOS ANIDADOS (más rápido)
  static async getEvents() {
    try {
      const eventsCol = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsCol);

      // Cargar datos completos (incluyendo subcollections) para todos los eventos en paralelo
      const events = await Promise.all(
        eventsSnapshot.docs.map(async (docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };

          // Siempre cargar subcollections — tienen prioridad sobre el doc principal
          const [participants, waitlist, results, rounds] = await Promise.all([
            this._loadEventParticipants(docSnap.id),
            this._loadEventWaitlist(docSnap.id),
            this._loadEventResults(docSnap.id),
            this._loadEventRounds(docSnap.id)
          ]);

          return {
            ...data,
            participants: participants.length > 0 ? participants : (data.participants || []),
            waitlist: waitlist.length > 0 ? waitlist : (data.waitlist || []),
            results: results.length > 0 ? results : (data.results || []),
            rounds: rounds.length > 0 ? rounds : (data.rounds || [])
          };
        })
      );

      return events;
    } catch (error) {
      console.error("Error fetching events: ", error);
      throw error;
    }
  }

  // Guardar múltiples eventos (redirige a saveEvent para mantener consistencia)
  static async saveEvents(events) {
    try {
      await Promise.all(events.map(event => this.saveEvent(event)));
      return { success: true };
    } catch (error) {
      console.error("Error saving events: ", error);
      throw error;
    }
  }

  // Guardar un solo evento (crear o actualizar) - OPTIMIZADO CON SUBCOLLECTIONS
  static async saveEvent(event) {
    try {
      const eventId = String(event.id);

      // Separar datos grandes que irán en subcollections
      const { participants, waitlist, results, rounds, ...baseEventData } = event;

      // Agregar timestamp
      const eventData = {
        ...baseEventData,
        updatedAt: new Date().toISOString(),
        participantCount: (participants || []).length,
        waitlistCount: (waitlist || []).length,
        roundCount: (rounds || []).length
      };

      // Guardar documento principal (mucho más pequeño)
      await setDoc(doc(collection(db, "events"), eventId), eventData);

      // Siempre guardar subcollections (aunque estén vacías, para limpiar datos anteriores)
      await Promise.all([
        this._saveEventParticipants(eventId, participants || []),
        this._saveEventWaitlist(eventId, waitlist || []),
        this._saveEventResults(eventId, results || []),
        this._saveEventRounds(eventId, rounds || [])
      ]);

      return { success: true };
    } catch (error) {
      console.error("Error saving event:", error);
      throw error;
    }
  }

  // Guardar participantes en subcollection
  static async _saveEventParticipants(eventId, participants) {
    try {
      const subcolRef = collection(db, "events", eventId, "participants");

      // Limpiar participantes anteriores
      const existing = await getDocs(subcolRef);
      const deletePromises = existing.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Guardar nuevos participantes
      const savePromises = participants.map((p, idx) =>
        setDoc(doc(subcolRef, `p${idx}`), { ...p, savedAt: new Date().toISOString() })
      );
      await Promise.all(savePromises);
    } catch (error) {
      console.error("Error saving participants:", error);
      throw error;
    }
  }

  // Guardar lista de espera en subcollection
  static async _saveEventWaitlist(eventId, waitlist) {
    try {
      const subcolRef = collection(db, "events", eventId, "waitlist");

      const existing = await getDocs(subcolRef);
      const deletePromises = existing.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const savePromises = waitlist.map((w, idx) =>
        setDoc(doc(subcolRef, `w${idx}`), { ...w, savedAt: new Date().toISOString() })
      );
      await Promise.all(savePromises);
    } catch (error) {
      console.error("Error saving waitlist:", error);
      throw error;
    }
  }

  // Guardar resultados en subcollection
  static async _saveEventResults(eventId, results) {
    try {
      const subcolRef = collection(db, "events", eventId, "results");

      const existing = await getDocs(subcolRef);
      const deletePromises = existing.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const savePromises = results.map((r, idx) =>
        setDoc(doc(subcolRef, `r${idx}`), { ...r, position: idx + 1, savedAt: new Date().toISOString() })
      );
      await Promise.all(savePromises);
    } catch (error) {
      console.error("Error saving results:", error);
      throw error;
    }
  }

  // Guardar rondas en subcollection
  static async _saveEventRounds(eventId, rounds) {
    try {
      const subcolRef = collection(db, "events", eventId, "rounds");

      const existing = await getDocs(subcolRef);
      const deletePromises = existing.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const savePromises = rounds.map((round, idx) =>
        setDoc(doc(subcolRef, `rnd${idx}`), {
          ...round,
          roundNumber: idx + 1,
          savedAt: new Date().toISOString()
        })
      );
      await Promise.all(savePromises);
    } catch (error) {
      console.error("Error saving rounds:", error);
      throw error;
    }
  }

  // Eliminar un evento por id - OPTIMIZADO PARA SUBCOLLECTIONS
  static async deleteEvent(eventId) {
    try {
      const eventId_str = String(eventId);
      const eventRef = doc(collection(db, "events"), eventId_str);

      // Eliminar subcollections
      const subcollections = ["participants", "waitlist", "results", "rounds"];
      const deletePromises = [];

      for (const subcol of subcollections) {
        const subcolRef = collection(db, "events", eventId_str, subcol);
        const docs = await getDocs(subcolRef);
        docs.forEach(doc => {
          deletePromises.push(deleteDoc(doc.ref));
        });
      }

      // Esperar a que se eliminen todos los documentos en subcollections
      await Promise.all(deletePromises);

      // Eliminar el documento principal
      await deleteDoc(eventRef);

      return { success: true };
    } catch (error) {
      console.error("Error deleting event: ", error);
      throw error;
    }
  }

  // Agregar un participante a un evento - COMPATIBLE CON VIEJA Y NUEVA ESTRUCTURA
  static async addEventParticipant(eventId, participantData) {
    try {
      const eventId_str = String(eventId);
      const eventRef = doc(db, "events", eventId_str);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        throw new Error("Evento no encontrado");
      }

      const eventData = eventSnap.data();

      // Siempre leer desde subcollections; si están vacías, usar el doc principal (estructura vieja)
      const [subParticipants, subWaitlist] = await Promise.all([
        this._loadEventParticipants(eventId_str),
        this._loadEventWaitlist(eventId_str)
      ]);

      const currentParticipants = subParticipants.length > 0 ? subParticipants : (eventData.participants || []);
      const currentWaitlist = subWaitlist.length > 0 ? subWaitlist : (eventData.waitlist || []);

      // Verificar si el participante ya existe
      const existsInMain = currentParticipants.some(p => p.gt7Id === participantData.gt7Id);
      if (existsInMain) {
        throw new Error("Este GT7 ID ya está registrado en el evento");
      }
      const existsInWaitlist = currentWaitlist.some(p => p.gt7Id === participantData.gt7Id);
      if (existsInWaitlist) {
        throw new Error("Este GT7 ID ya está en la lista de reservas");
      }

      const maxParticipants = eventData.maxParticipants;
      const isFull = maxParticipants && currentParticipants.length >= maxParticipants;

      const newParticipant = {
        ...participantData,
        registeredAt: new Date().toISOString()
      };

      if (isFull) {
        const waitlistPosition = currentWaitlist.length + 1;
        const updatedWaitlist = [...currentWaitlist, { ...newParticipant, waitlistPosition }];

        // Siempre guardar en subcollections y actualizar contadores en doc principal
        await Promise.all([
          this._saveEventWaitlist(eventId_str, updatedWaitlist),
          updateDoc(eventRef, { waitlistCount: updatedWaitlist.length, updatedAt: new Date().toISOString() })
        ]);

        return { success: true, waitlisted: true, position: waitlistPosition, participant: newParticipant };
      }

      const updatedParticipants = [...currentParticipants, newParticipant];

      // Siempre guardar en subcollections y actualizar contadores en doc principal
      await Promise.all([
        this._saveEventParticipants(eventId_str, updatedParticipants),
        updateDoc(eventRef, { participantCount: updatedParticipants.length, updatedAt: new Date().toISOString() })
      ]);

      return { success: true, waitlisted: false, participant: newParticipant };
    } catch (error) {
      console.error("Error adding participant:", error);
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
  // PENALTIES METHODS (subcolección championships/{id}/penalties)
  // ========================================

  static async getPenaltiesByChampionship(championshipId) {
    try {
      const col = collection(db, "championships", championshipId, "penalties");
      const q = query(col, orderBy("appliedAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => Penalty.fromFirestore(doc.id, doc.data()));
    } catch (error) {
      console.error("Error fetching penalties:", error);
      throw error;
    }
  }

  static async createPenalty(championshipId, penaltyData) {
    try {
      const penalty = new Penalty({ ...penaltyData, championshipId });
      const validation = penalty.validate();
      if (!validation.isValid) throw new Error(validation.errors.join(', '));

      const docRef = await addDoc(
        collection(db, "championships", championshipId, "penalties"),
        penalty.toFirestore()
      );
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error creating penalty:", error);
      throw error;
    }
  }

  static async updatePenalty(championshipId, penaltyId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "penalties", penaltyId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      console.error("Error updating penalty:", error);
      throw error;
    }
  }

  static async deletePenalty(championshipId, penaltyId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId, "penalties", penaltyId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting penalty:", error);
      throw error;
    }
  }

  // ========================================
  // CLAIMS METHODS (subcolección championships/{id}/claims)
  // ========================================

  static async createClaim(championshipId, claimData) {
    try {
      const claim = new Claim({ ...claimData, championshipId });
      const validation = claim.validate();
      if (!validation.isValid) throw new Error(validation.errors.join(', '));
      const docRef = await addDoc(
        collection(db, "championships", championshipId, "claims"),
        claim.toFirestore()
      );
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error creating claim:", error);
      throw error;
    }
  }

  static async getClaimsByChampionship(championshipId) {
    try {
      const col = collection(db, "championships", championshipId, "claims");
      const q = query(col, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => Claim.fromFirestore(doc.id, doc.data()));
    } catch (error) {
      console.error("Error fetching claims:", error);
      throw error;
    }
  }

  static async updateClaim(championshipId, claimId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "claims", claimId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      console.error("Error updating claim:", error);
      throw error;
    }
  }

  // ========================================
  // DIVISIONS METHODS (subcolección championships/{id}/divisions)
  // ========================================

  static async getDivisionsByChampionship(championshipId) {
    try {
      const col = collection(db, "championships", championshipId, "divisions");
      const q = query(col, orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching divisions:", error);
      throw error;
    }
  }

  static async createDivision(championshipId, divisionData) {
    try {
      const docRef = await addDoc(
        collection(db, "championships", championshipId, "divisions"),
        { ...divisionData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      );
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error creating division:", error);
      throw error;
    }
  }

  static async updateDivision(championshipId, divisionId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId, "divisions", divisionId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      console.error("Error updating division:", error);
      throw error;
    }
  }

  static async deleteDivision(championshipId, divisionId) {
    try {
      await deleteDoc(doc(db, "championships", championshipId, "divisions", divisionId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting division:", error);
      throw error;
    }
  }

  // ========================================
  // CHAMPIONSHIP REGISTRATION METHODS
  // ========================================

  /**
   * Enviar inscripción a un campeonato (acción pública del piloto)
   */
  static async submitRegistration(championshipId, data) {
    try {
      const docRef = doc(db, "championships", championshipId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Campeonato no encontrado');

      const champ = snap.data();
      const reg = champ.registration || {};
      const existing = (champ.registrations || []);

      // Fecha límite
      if (reg.deadline && new Date() > new Date(reg.deadline + 'T23:59:59')) {
        throw new Error('El plazo de inscripción ha vencido');
      }

      // Cupo lleno
      const approvedCount = existing.filter(r => r.status === 'approved').length;
      if (reg.maxParticipants > 0 && approvedCount >= reg.maxParticipants) {
        throw new Error('No hay cupos disponibles');
      }

      // Duplicado (mismo gt7Id o psnId)
      const gt7Id = data.gt7Id?.trim().toLowerCase();
      const psnId = data.psnId?.trim().toLowerCase();
      const isDuplicate = existing.some(r =>
        (gt7Id && r.gt7Id?.toLowerCase() === gt7Id) ||
        (psnId && r.psnId?.toLowerCase() === psnId)
      );
      if (isDuplicate) throw new Error('Ya tienes una inscripción enviada para este campeonato');

      const regData = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        status: reg.requiresApproval ? 'pending' : 'approved',
        createdAt: new Date().toISOString()
      };

      await updateDoc(docRef, { registrations: arrayUnion(regData) });

      // Si es auto-approve y campeonato individual, agregar piloto directamente
      if (!reg.requiresApproval && !champ.settings?.isTeamChampionship) {
        const driverName = data.gt7Id || data.psnId || data.name || 'Piloto';
        const existingDrivers = champ.drivers || [];
        const alreadyDriver = existingDrivers.some(
          d => d.name?.toLowerCase() === driverName.toLowerCase()
        );
        if (!alreadyDriver) {
          await updateDoc(docRef, {
            drivers: arrayUnion({ name: driverName, category: data.category || '' })
          });
        }
      }

      return { success: true, registration: regData };
    } catch (error) {
      console.error('Error submitting registration:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de una o varias inscripciones (acción admin)
   * @param {string} championshipId
   * @param {Array<{id: string, status: string}>} updates
   */
  static async updateRegistrations(championshipId, updates) {
    try {
      const docRef = doc(db, "championships", championshipId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Campeonato no encontrado');

      const champ = snap.data();
      const registrations = [...(champ.registrations || [])];
      const reviewedAt = new Date().toISOString();

      const updMap = Object.fromEntries(updates.map(u => [u.id, u.status]));
      const updatedRegistrations = registrations.map(r =>
        updMap[r.id] ? { ...r, status: updMap[r.id], reviewedAt } : r
      );

      // Para campeonatos individuales: auto-agregar como piloto cuando se aprueba
      let driversToAdd = [];
      if (!champ.settings?.isTeamChampionship) {
        const existingDriverNames = new Set(
          (champ.drivers || []).map(d => d.name?.toLowerCase())
        );
        updates
          .filter(u => u.status === 'approved')
          .forEach(u => {
            const reg = registrations.find(r => r.id === u.id);
            if (!reg) return;
            const driverName = reg.name || reg.psnId || reg.gt7Id;
            if (driverName && !existingDriverNames.has(driverName.toLowerCase())) {
              driversToAdd.push({ name: driverName, category: reg.category || '' });
              existingDriverNames.add(driverName.toLowerCase());
            }
          });
      }

      const updatePayload = { registrations: updatedRegistrations };
      if (driversToAdd.length > 0) {
        updatePayload.drivers = [...(champ.drivers || []), ...driversToAdd];
      }

      await updateDoc(docRef, updatePayload);
      return { success: true, addedDrivers: driversToAdd.length };
    } catch (error) {
      console.error('Error updating registrations:', error);
      throw error;
    }
  }

  /**
   * Guardar resultados de Pre-Qualy en el campeonato
   * @param {string} championshipId
   * @param {Array<{driverName: string, time: string, classified: boolean}>} results
   */
  static async savePreQualyResults(championshipId, results) {
    try {
      const docRef = doc(db, 'championships', championshipId);
      await updateDoc(docRef, {
        'preQualy.results': results
      });
      return { success: true };
    } catch (error) {
      console.error('Error saving pre-qualy results:', error);
      throw error;
    }
  }

  /**
   * Editar datos de una inscripción específica (gt7Id, psnId, etc.)
   * @param {string} championshipId
   * @param {string} registrationId
   * @param {Object} updates - Campos a actualizar (gt7Id, psnId, ...)
   */
  static async updateRegistrationData(championshipId, registrationId, updates) {
    try {
      const docRef = doc(db, 'championships', championshipId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Campeonato no encontrado');

      const registrations = snap.data().registrations || [];
      const updated = registrations.map(r =>
        r.id === registrationId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );

      await updateDoc(docRef, { registrations: updated });
      return { success: true };
    } catch (error) {
      console.error('Error updating registration data:', error);
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