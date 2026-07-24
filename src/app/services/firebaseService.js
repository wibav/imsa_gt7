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
  increment,
  writeBatch,
  deleteField,
  runTransaction
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { app, auth } from "../api/firebase/firebaseConfig";
// Fuente única de límites por plan, compartida con functions/main.py (que
// la importa desde el mismo archivo) — antes vivían duplicados a mano aquí
// y en Python, con solo un comentario pidiendo mantenerlos en sync.
import PLAN_LIMITS_JSON from "../../../functions/planLimits.json";
import { Championship, Team, Track, Event } from "../models/Championship";
import { Penalty, Claim } from "../models/Penalty";

const db = getFirestore(app);
const storage = getStorage(app);

// Fase 3 (routing por organización, ver ADR-002/SPEC-3): FirebaseService es
// una clase estática, no un componente React, así que no puede leer
// OrganizationContext directamente. OrganizationProvider llama a
// FirebaseService.setCurrentOrgId(orgId) apenas resuelve el tenant desde la
// URL, y todas las queries de abajo leen esta variable de módulo. Por
// defecto es 'gt7-esp' (comportamiento idéntico al de antes de Fase 3, para
// cualquier ruta que no use el prefijo /l/{slug}).
let currentOrgId = 'gt7-esp';

export class FirebaseService {
  static setCurrentOrgId(orgId) {
    currentOrgId = orgId;
  }

  static getCurrentOrgId() {
    return currentOrgId;
  }

  // Obtener todos los equipos (catálogo de la organización activa)
  static async getTeams() {
    try {
      const q = query(collection(db, "teams"), where("orgId", "==", currentOrgId));
      const teamSnapshot = await getDocs(q);
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

  // Guardar equipos (estampa siempre orgId, sin depender de que el estado
  // de la UI lo preserve — saveTeams hace un reemplazo completo del doc)
  static async saveTeams(teams) {
    try {
      const promises = teams.map(team =>
        setDoc(doc(collection(db, "teams"), String(team.id)), { ...team, orgId: currentOrgId })
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
  // allOrgs: true → sin filtro de orgId (solo para la vista agregada de la
  // URL raíz, que muestra eventos de todas las organizaciones — ver SPEC-3).
  static async getEvents({ allOrgs = false } = {}) {
    try {
      const q = allOrgs
        ? collection(db, "events")
        : query(collection(db, "events"), where("orgId", "==", currentOrgId));
      const eventsSnapshot = await getDocs(q);

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

      // Agregar timestamp — orgId siempre se estampa aquí (no se confía en
      // que el estado de la UI lo preserve; saveEvent reemplaza el doc completo)
      const eventData = {
        ...baseEventData,
        orgId: currentOrgId,
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

      // Inscripción pública (sin sesión): solo puede CREAR un documento
      // nuevo en la subcolección, nunca borrar/regenerar los existentes
      // (firestore.rules exige isOrgAdmin para update/delete ahí). Antes
      // esto pasaba por _saveEventParticipants/_saveEventWaitlist, que
      // borran y recrean TODA la subcolección — funciona para el admin
      // (guardado masivo autenticado) pero le devuelve "missing or
      // insufficient permissions" a cualquier inscripción pública que no
      // sea la primera del evento, porque el borrado de los docs ya
      // existentes queda denegado. El id incluye un timestamp para que
      // `_loadEventParticipants`/`_loadEventWaitlist` (que ordenan por id)
      // seguian reflejando el orden real de inscripción.
      if (isFull) {
        const waitlistPosition = currentWaitlist.length + 1;
        const entryId = `w${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await Promise.all([
          setDoc(doc(db, "events", eventId_str, "waitlist", entryId), { ...newParticipant, waitlistPosition, savedAt: new Date().toISOString() }),
          updateDoc(eventRef, { waitlistCount: currentWaitlist.length + 1, updatedAt: new Date().toISOString() })
        ]);

        return { success: true, waitlisted: true, position: waitlistPosition, participant: newParticipant };
      }

      const participantId = `p${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await Promise.all([
        setDoc(doc(db, "events", eventId_str, "participants", participantId), { ...newParticipant, savedAt: new Date().toISOString() }),
        updateDoc(eventRef, { participantCount: currentParticipants.length + 1, updatedAt: new Date().toISOString() })
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
  // allOrgs: true → sin filtro de orgId (vista agregada de la URL raíz).
  static async getChampionships({ allOrgs = false } = {}) {
    try {
      const championshipsCol = collection(db, "championships");
      const q = query(championshipsCol, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      // Filtro por orgId en cliente (no en la query): combinar where(orgId)
      // con el orderBy(createdAt) existente exigiría un índice compuesto
      // nuevo en Firestore. Con el volumen actual (unos pocos campeonatos)
      // filtrar aquí es más seguro que desplegar un índice sin poder
      // validarlo antes. Reevaluar si el volumen de datos crece (ver
      // 02-ESPECIFICACIONES.md SPEC-2).
      const all = snapshot.docs.map(doc => Championship.fromFirestore(doc.id, doc.data()));
      return allOrgs ? all : all.filter(c => c.orgId === currentOrgId);
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

      // Filtro por orgId en cliente — mismo motivo que getChampionships().
      return snapshot.docs
        .map(doc => Championship.fromFirestore(doc.id, doc.data()))
        .filter(c => c.orgId === currentOrgId);
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
      const championship = new Championship({ ...championshipData, orgId: currentOrgId });
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

  /**
   * Propaga el layoutImage actualizado del catálogo global a todos los campeonatos
   * que tengan una carrera con el mismo nombre de circuito.
   * @param {string} trackName - Nombre del circuito
   * @param {string} layoutImage - Nueva URL de imagen
   */
  static async propagateTrackImage(trackName, layoutImage) {
    try {
      const championships = await FirebaseService.getChampionships();
      const normalizedName = (trackName || '').trim().toLowerCase();
      const promises = championships.map(async (champ) => {
        const champTracks = await FirebaseService.getTracksByChampionship(champ.id);
        const matches = champTracks.filter(
          t => (t.name || '').trim().toLowerCase() === normalizedName
        );
        return Promise.all(
          matches.map(t =>
            FirebaseService.updateTrack(champ.id, t.id, { layoutImage })
          )
        );
      });
      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      console.error('Error propagating track image:', error);
      // No lanzar — es una operación secundaria
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

      const isTeamReg = Array.isArray(data.drivers) && data.drivers.length > 0;

      if (isTeamReg) {
        // Duplicado en inscripción de equipo: verificar cada piloto individualmente
        const existingGt7Ids = new Set(
          existing.flatMap(r =>
            Array.isArray(r.drivers)
              ? r.drivers.map(d => d.gt7Id?.toLowerCase()).filter(Boolean)
              : [r.gt7Id?.toLowerCase()].filter(Boolean)
          )
        );
        for (const driver of data.drivers) {
          const dId = driver.gt7Id?.trim().toLowerCase();
          if (dId && existingGt7Ids.has(dId)) {
            throw new Error(`El piloto "${driver.gt7Id}" ya tiene una inscripción en este campeonato`);
          }
        }
      } else {
        // Duplicado (mismo gt7Id o psnId)
        const gt7Id = data.gt7Id?.trim().toLowerCase();
        const psnId = data.psnId?.trim().toLowerCase();
        const isDuplicate = existing.some(r =>
          (gt7Id && r.gt7Id?.toLowerCase() === gt7Id) ||
          (psnId && r.psnId?.toLowerCase() === psnId)
        );
        if (isDuplicate) throw new Error('Ya tienes una inscripción enviada para este campeonato');
      }

      const regData = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        status: reg.requiresApproval ? 'pending' : 'approved',
        createdAt: new Date().toISOString()
      };

      // Si es auto-approve, los pilotos se agregan a championship.drivers en
      // la MISMA escritura que registrations — firestore.rules solo permite
      // al público tocar ambos campos juntos (onlyAffects(['registrations',
      // 'drivers'])). Antes esto era un updateDoc separado tocando solo
      // `drivers`, que las rules siempre denegaron ("missing or
      // insufficient permissions") para cualquier campeonato con
      // requiresApproval=false.
      const updatePayload = { registrations: arrayUnion(regData) };

      if (!reg.requiresApproval) {
        if (isTeamReg) {
          // Equipo: agregar cada piloto a championship.drivers
          const existingDrivers = champ.drivers || [];
          const existingNames = new Set(existingDrivers.map(d => d.name?.toLowerCase()));
          const toAdd = data.drivers
            .map(d => ({ name: d.gt7Id || d.psnId, category: d.category || '' }))
            .filter(d => d.name && !existingNames.has(d.name.toLowerCase()));
          if (toAdd.length > 0) {
            updatePayload.drivers = [...existingDrivers, ...toAdd];
          }
        } else if (!champ.settings?.isTeamChampionship) {
          const driverName = data.gt7Id || data.psnId || data.name || 'Piloto';
          const existingDrivers = champ.drivers || [];
          const alreadyDriver = existingDrivers.some(
            d => d.name?.toLowerCase() === driverName.toLowerCase()
          );
          if (!alreadyDriver) {
            updatePayload.drivers = arrayUnion({ name: driverName, category: data.category || '' });
          }
        }
      }

      await updateDoc(docRef, updatePayload);

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

      // Al aprobar: agregar pilotos a championship.drivers
      let driversToAdd = [];
      const existingDriverNames = new Set(
        (champ.drivers || []).map(d => d.name?.toLowerCase())
      );
      updates
        .filter(u => u.status === 'approved')
        .forEach(u => {
          const reg = registrations.find(r => r.id === u.id);
          if (!reg) return;
          if (Array.isArray(reg.drivers) && reg.drivers.length > 0) {
            // Inscripción de equipo: agregar cada piloto
            reg.drivers.forEach(d => {
              const name = d.gt7Id || d.psnId;
              if (name && !existingDriverNames.has(name.toLowerCase())) {
                driversToAdd.push({ name, category: d.category || '' });
                existingDriverNames.add(name.toLowerCase());
              }
            });
          } else if (!champ.settings?.isTeamChampionship) {
            // Inscripción individual
            const driverName = reg.name || reg.psnId || reg.gt7Id;
            if (driverName && !existingDriverNames.has(driverName.toLowerCase())) {
              driversToAdd.push({ name: driverName, category: reg.category || '' });
              existingDriverNames.add(driverName.toLowerCase());
            }
          }
        });

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
   * Da de baja a un piloto con inscripción individual (no de equipo): quita
   * su registro de `registrations`, su entrada en `drivers`, y lo remueve de
   * cualquier división a la que estuviera asignado — libera el cupo y deja
   * de contar en clasificaciones futuras. Los resultados ya corridos
   * (`track.points`/`track.results`) se preservan intencionalmente: dar de
   * baja no debe alterar el historial de carreras ya disputadas.
   *
   * No soporta inscripciones de equipo (`reg.drivers[]`) — quitar a un
   * piloto de un roster de equipo es un flujo distinto (editar el equipo),
   * no "dar de baja" del campeonato completo.
   *
   * @param {string} championshipId
   * @param {string} registrationId - r.id de la entrada en registrations[]
   * @param {Array} divisions - divisiones ya cargadas del campeonato (para no releer)
   */
  static async withdrawRegistration(championshipId, registrationId, divisions = []) {
    const docRef = doc(db, 'championships', championshipId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Campeonato no encontrado');
    const champ = snap.data();

    const reg = (champ.registrations || []).find(r => r.id === registrationId);
    if (!reg) throw new Error('Inscripción no encontrada');
    if (Array.isArray(reg.drivers) && reg.drivers.length > 0) {
      throw new Error('Esta es una inscripción de equipo — edita el roster del equipo en vez de dar de baja aquí');
    }

    // Mismos 3 identificadores con los que se guardó en drivers[]/division.drivers[]
    // al aprobar (ver updateRegistrations) — hay que cubrir los 3 para no dejar huérfanos.
    const identifiers = [reg.name, reg.psnId, reg.gt7Id].filter(Boolean);

    const updatedRegistrations = (champ.registrations || []).filter(r => r.id !== registrationId);
    const updatedDrivers = (champ.drivers || []).filter(d => !identifiers.includes(d.name));
    await updateDoc(docRef, { registrations: updatedRegistrations, drivers: updatedDrivers });

    const affectedDivisions = divisions.filter(d => (d.drivers || []).some(name => identifiers.includes(name)));
    await Promise.all(affectedDivisions.map(d =>
      FirebaseService.updateDivision(championshipId, d.id, {
        drivers: (d.drivers || []).filter(name => !identifiers.includes(name)),
      })
    ));

    return { removedFromDivisions: affectedDivisions.map(d => d.name) };
  }

  /**
   * Da de baja a UN piloto dentro del roster de un equipo (campeonato por
   * equipos, `championship.settings.isTeamChampionship`). A diferencia de
   * las inscripciones individuales, aquí un piloto vive en hasta 3
   * ubicaciones desconectadas entre sí (sin IDs relacionales, todo se
   * cruza por nombre = gt7Id||psnId, mismo criterio que el resto del
   * modelo de datos):
   *   1. `teams/{teamId}.drivers[]` — el roster real que usa DriversTab/
   *      standingsCalculator para clasificación por equipos.
   *   2. `championship.registrations[].drivers[]` — la inscripción de
   *      equipo original; si era el último piloto de esa inscripción, se
   *      elimina el registro completo (equipo sin pilotos ya no tiene
   *      sentido como inscripción activa).
   *   3. `championship.drivers[]` — lista plana que también alimenta la
   *      clasificación individual (ver standingsCalculator.getAllDrivers);
   *      sin esta limpieza el piloto seguiría puntuando ahí aunque ya no
   *      esté en su equipo.
   * Más `division.drivers[]` si estaba asignado a una sala, igual que en
   * withdrawRegistration. Preserva track.points/results a propósito.
   *
   * @param {string} championshipId
   * @param {string} teamId
   * @param {string} driverName - team.drivers[].name a quitar
   * @param {Array} divisions - divisiones ya cargadas (para no releer)
   */
  static async withdrawTeamDriver(championshipId, teamId, driverName, divisions = []) {
    const champRef = doc(db, 'championships', championshipId);
    const teamRef = doc(db, 'championships', championshipId, 'teams', teamId);
    const [champSnap, teamSnap] = await Promise.all([getDoc(champRef), getDoc(teamRef)]);
    if (!champSnap.exists()) throw new Error('Campeonato no encontrado');
    if (!teamSnap.exists()) throw new Error('Equipo no encontrado');

    const champ = champSnap.data();
    const team = teamSnap.data();

    const updatedTeamDrivers = (team.drivers || []).filter(d => d.name !== driverName);
    await updateDoc(teamRef, { drivers: updatedTeamDrivers });

    const updatedRegistrations = (champ.registrations || [])
      .map(r => {
        if (r.teamName !== team.name || !Array.isArray(r.drivers)) return r;
        return { ...r, drivers: r.drivers.filter(d => (d.gt7Id || d.psnId) !== driverName) };
      })
      .filter(r => !(r.teamName === team.name && Array.isArray(r.drivers) && r.drivers.length === 0));

    const updatedChampDrivers = (champ.drivers || []).filter(d => d.name !== driverName);
    await updateDoc(champRef, { registrations: updatedRegistrations, drivers: updatedChampDrivers });

    const affectedDivisions = divisions.filter(d => (d.drivers || []).includes(driverName));
    await Promise.all(affectedDivisions.map(d =>
      FirebaseService.updateDivision(championshipId, d.id, {
        drivers: (d.drivers || []).filter(name => name !== driverName),
      })
    ));

    return { removedFromDivisions: affectedDivisions.map(d => d.name) };
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

  /**
   * Renombra a un piloto en TODAS las ubicaciones del modelo de datos donde
   * su identificador vive denormalizado — sin ningún ID relacional, todo se
   * cruza por el nombre = name||psnId||gt7Id (ver DivisionsTab.js/
   * standingsCalculator.js). Necesario porque editar el GT7 ID/PSN ID de una
   * inscripción (RegistrationsTab "✏️ Editar datos") por sí solo NO
   * actualiza nada más: el piloto seguiría apareciendo bajo el identificador
   * viejo en su división, sus resultados ya cargados, y cualquier
   * reclamación/sanción donde participe — el mismo problema que obligó a
   * corregir "Zeus GM" a mano con un script (ver scripts/
   * rename-driver-zeusguerrero.js).
   *
   * Se intenta renombrar CADA identificador antiguo candidato (puede haber
   * más de uno: name/psnId/gt7Id previos a la edición) — renombrar una
   * clave que no existe en un lugar dado es un no-op seguro, así que no
   * hace falta saber de antemano cuál de los 3 estaba realmente en uso.
   *
   * @param {string} championshipId
   * @param {string[]} oldKeys - identificadores previos a la edición (name/psnId/gt7Id)
   * @param {string} newKey - nuevo identificador canónico (gt7Id corregido)
   * @returns {Promise<{renamed: boolean}>}
   */
  static async renameDriverEverywhere(championshipId, oldKeys, newKey) {
    const candidates = [...new Set(oldKeys)].filter(k => k && k !== newKey);
    if (candidates.length === 0) return { renamed: false };

    const isOld = (v) => candidates.includes(v);
    const renameMapKeys = (map = {}) => {
      const out = { ...map };
      candidates.forEach(oldKey => {
        if (oldKey in out) {
          out[newKey] = out[oldKey];
          delete out[oldKey];
        }
      });
      return out;
    };
    const renameArrayEntries = (arr = []) => arr.map(v => isOld(v) ? newKey : v);
    const renameSingleValue = (v) => isOld(v) ? newKey : v;

    const renameSessionResult = (res = {}) => ({
      ...res,
      ...(res.racePositions ? { racePositions: renameMapKeys(res.racePositions) } : {}),
      ...(res.racePoints ? { racePoints: renameMapKeys(res.racePoints) } : {}),
      ...(res.sprintPositions ? { sprintPositions: renameMapKeys(res.sprintPositions) } : {}),
      ...(res.sprintPoints ? { sprintPoints: renameMapKeys(res.sprintPoints) } : {}),
      ...(res.qualifying ? {
        qualifying: {
          ...res.qualifying,
          ...(res.qualifying.top3 ? {
            top3: {
              ...res.qualifying.top3,
              ...(res.qualifying.top3.first !== undefined ? { first: renameSingleValue(res.qualifying.top3.first) } : {}),
              ...(res.qualifying.top3.second !== undefined ? { second: renameSingleValue(res.qualifying.top3.second) } : {}),
              ...(res.qualifying.top3.third !== undefined ? { third: renameSingleValue(res.qualifying.top3.third) } : {}),
            }
          } : {}),
          ...(res.qualifying.points ? { points: renameMapKeys(res.qualifying.points) } : {}),
        }
      } : {}),
      ...(res.fastestLap ? {
        fastestLap: {
          ...res.fastestLap,
          ...(res.fastestLap.driver !== undefined ? { driver: renameSingleValue(res.fastestLap.driver) } : {}),
          ...(res.fastestLap.points ? { points: renameMapKeys(res.fastestLap.points) } : {}),
        }
      } : {}),
    });

    const batch = writeBatch(db);
    let touched = false;

    const champRef = doc(db, 'championships', championshipId);
    const champSnap = await getDoc(champRef);
    if (!champSnap.exists()) throw new Error('Campeonato no encontrado');
    const champ = champSnap.data();

    // 1) championship.drivers[]
    const updatedDrivers = (champ.drivers || []).map(d => isOld(d.name) ? { ...d, name: newKey } : d);
    if (JSON.stringify(updatedDrivers) !== JSON.stringify(champ.drivers || [])) {
      batch.update(champRef, { drivers: updatedDrivers });
      touched = true;
    }

    // 2) championship.preQualy.results[]
    if (Array.isArray(champ.preQualy?.results) && champ.preQualy.results.some(r => isOld(r.driverName))) {
      const updatedResults = champ.preQualy.results.map(r => isOld(r.driverName) ? { ...r, driverName: newKey } : r);
      batch.update(champRef, { 'preQualy.results': updatedResults });
      touched = true;
    }

    // 3) divisions/{divId}.drivers[]
    const divsSnap = await getDocs(collection(db, 'championships', championshipId, 'divisions'));
    divsSnap.forEach(d => {
      const drivers = d.data().drivers || [];
      if (drivers.some(isOld)) {
        batch.update(d.ref, { drivers: renameArrayEntries(drivers) });
        touched = true;
      }
    });

    // 4) tracks/{trackId} — points, carsUsed, sprintPoints, results (flat y por división)
    const tracksSnap = await getDocs(collection(db, 'championships', championshipId, 'tracks'));
    tracksSnap.forEach(t => {
      const track = t.data();
      const update = {};

      if (track.points) {
        const renamed = renameMapKeys(track.points);
        if (JSON.stringify(renamed) !== JSON.stringify(track.points)) update.points = renamed;
      }
      if (track.carsUsed) {
        const renamed = renameMapKeys(track.carsUsed);
        if (JSON.stringify(renamed) !== JSON.stringify(track.carsUsed)) update.carsUsed = renamed;
      }
      if (track.sprintPoints) {
        const renamed = renameMapKeys(track.sprintPoints);
        if (JSON.stringify(renamed) !== JSON.stringify(track.sprintPoints)) update.sprintPoints = renamed;
      }
      if (track.results?.divisions) {
        const renamedDivisions = Object.fromEntries(
          Object.entries(track.results.divisions).map(([divId, res]) => [divId, renameSessionResult(res)])
        );
        if (JSON.stringify(renamedDivisions) !== JSON.stringify(track.results.divisions)) {
          update.results = { ...track.results, divisions: renamedDivisions };
        }
      } else if (track.results) {
        const renamedResults = renameSessionResult(track.results);
        if (JSON.stringify(renamedResults) !== JSON.stringify(track.results)) {
          update.results = renamedResults;
        }
      }

      if (Object.keys(update).length > 0) {
        batch.update(t.ref, update);
        touched = true;
      }
    });

    // 5) claims — reporterName, accusedNames[]
    const claimsSnap = await getDocs(collection(db, 'championships', championshipId, 'claims'));
    claimsSnap.forEach(c => {
      const claim = c.data();
      const update = {};
      if (isOld(claim.reporterName)) update.reporterName = newKey;
      if (Array.isArray(claim.accusedNames) && claim.accusedNames.some(isOld)) {
        update.accusedNames = renameArrayEntries(claim.accusedNames);
      }
      if (Object.keys(update).length > 0) {
        batch.update(c.ref, update);
        touched = true;
      }
    });

    // 6) penalties — driverName
    const penaltiesSnap = await getDocs(collection(db, 'championships', championshipId, 'penalties'));
    penaltiesSnap.forEach(p => {
      if (isOld(p.data().driverName)) {
        batch.update(p.ref, { driverName: newKey });
        touched = true;
      }
    });

    if (touched) await batch.commit();
    return { renamed: touched };
  }

  /**
   * Guarda la declaración de autos de un piloto inscrito.
   * Llama a updateRegistrationData internamente — método semántico para la Fase B.
   *
   * @param {string} championshipId
   * @param {string} registrationId - r.id de la entrada en registrations[]
   * @param {string[]} declaredCars - Array de nombres de autos declarados
   */
  static async saveDeclaredCars(championshipId, registrationId, declaredCars) {
    return FirebaseService.updateRegistrationData(championshipId, registrationId, { declaredCars });
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

  // ══════════════════════════════════════════
  // Gestión de roles de usuario (admins / comisarios)
  // Fuente de verdad: Custom Claims del token (asignados por la Cloud
  // Function manage_user_role, Admin SDK). Colección userRoles = espejo de
  // solo lectura para la UI de /usersAdmin (doc id = email, ver
  // functions/main.py:_email_to_doc_id).
  // ══════════════════════════════════════════

  /**
   * Llama a la Cloud Function manage_user_role (requiere ser admin autenticado).
   * Reemplaza la escritura directa a Firestore: las rules ahora bloquean
   * escrituras de cliente a userRoles — solo el Admin SDK (esta función) puede.
   */
  static async _callManageUserRole(targetEmail, orgId, role, displayName = '') {
    if (!auth.currentUser) throw new Error('Debes iniciar sesión');
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/manage-user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ targetEmail, orgId, role, displayName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Error al gestionar el rol del usuario');
    }
    return data;
  }

  /** Asignar o actualizar el rol de un usuario en una organización:
   *  'organizador' | 'director_liga' | 'comisario' */
  static async setUserRole(email, orgId, role, displayName = '') {
    return FirebaseService._callManageUserRole(email, orgId, role, displayName);
  }

  /** Quitar el rol de un usuario en una organización (vuelve a ser usuario normal ahí) */
  static async removeUserRole(email, orgId) {
    return FirebaseService._callManageUserRole(email, orgId, null);
  }

  /** Obtener los comisarios de una organización (mirror de custom claims) */
  static async getComisarios(orgId) {
    try {
      const q = query(
        collection(db, 'memberships'),
        where('orgId', '==', orgId),
        where('role', '==', 'comisario')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error getting comisarios:', error);
      return [];
    }
  }

  /** Obtener los directores de liga + organizador de una organización */
  static async getAdmins(orgId) {
    try {
      const q = query(
        collection(db, 'memberships'),
        where('orgId', '==', orgId),
        where('role', 'in', ['organizador', 'director_liga'])
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error getting admins:', error);
      return [];
    }
  }

  // ══════════════════════════════════════════
  // Organizaciones (Fase 1 — multi-tenant)
  // ══════════════════════════════════════════

  /** Obtener una organización por id (branding, reglamento, plan, etc.) */
  static async getOrganization(orgId) {
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
      console.error('Error getting organization:', error);
      return null;
    }
  }

  /** Nombres de organizaciones por id, para la vista agregada de la raíz
   *  (etiquetar de qué organización es cada campeonato/evento). `where(in)`
   *  soporta hasta 30 ids — más que suficiente para el número de
   *  organizaciones esperado en el corto plazo. */
  static async getOrganizationNames(orgIds) {
    const uniqueIds = [...new Set(orgIds)].filter(Boolean).slice(0, 30);
    if (uniqueIds.length === 0) return {};
    try {
      const q = query(collection(db, 'organizations'), where('__name__', 'in', uniqueIds));
      const snap = await getDocs(q);
      const names = {};
      snap.docs.forEach(d => { names[d.id] = d.data().name || d.id; });
      return names;
    } catch (error) {
      console.error('Error getting organization names:', error);
      return {};
    }
  }

  /** Todas las organizaciones + su organizador (email), para el panel del
   *  Administrador de Plataforma (/organizacionesAdmin). El email del
   *  organizador sale de `memberships` (no de Firebase Auth — el cliente no
   *  tiene acceso al Admin SDK), que ya guarda el email en texto plano ahí. */
  static async getAllOrganizations() {
    try {
      const [orgsSnap, ownersSnap] = await Promise.all([
        getDocs(collection(db, 'organizations')),
        getDocs(query(collection(db, 'memberships'), where('role', '==', 'organizador'))),
      ]);
      const ownerEmailByOrgId = {};
      ownersSnap.docs.forEach(d => { ownerEmailByOrgId[d.data().orgId] = d.data().email; });
      return orgsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), ownerEmail: ownerEmailByOrgId[d.id] || null }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (error) {
      console.error('Error getting all organizations:', error);
      return [];
    }
  }

  /** Actualiza el branding (logo, colores) de una organización — llamado por
   *  el propio Organizador desde /organizacionAdmin. `firestore.rules` solo
   *  le permite tocar los campos `branding`/`reglamento`/`updatedAt` de su
   *  propia organización (nunca plan/billing/límites). */
  static async updateOrganizationBranding(orgId, branding) {
    await updateDoc(doc(db, 'organizations', orgId), {
      branding,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Límites por plan — ver functions/planLimits.json, fuente única
   *  compartida con functions/main.py. */
  static PLAN_LIMITS = PLAN_LIMITS_JSON;

  /** Otorga un lote de créditos a una organización y/o le cambia el plan —
   *  vía manual (comp de cortesía, o venta fuera de Paddle) desde
   *  /organizacionesAdmin. `firestore.rules` solo permite escribir
   *  `organizations/{orgId}` sin restricción de campos al Administrador de
   *  Plataforma, así que esto solo puede llamarse con esa sesión. `newPlan`
   *  es opcional; si se pasa, también actualiza `limits`/`aiEnabled` para
   *  que quede consistente con lo que aplicaría el webhook de Paddle para
   *  ese mismo plan.
   *
   *  Comprar un lote (creditsToAdd > 0, siempre el caso en este formulario)
   *  elimina el límite de pilotos permanentemente — igual que hace
   *  paddle_webhook con `creditsPurchased`/`limits.maxDrivers`. No aplica al
   *  crédito de prueba inicial del plan Free (ese se otorga en
   *  create_organization, no aquí). */
  static async grantChampionshipCredits(orgId, creditsToAdd, newPlan = null) {
    const purchasingCredits = creditsToAdd > 0;
    const orgRef = doc(db, 'organizations', orgId);

    // Transacción (no getDoc + updateDoc sueltos): esto puede correr casi al
    // mismo tiempo que paddle_webhook procesa una compra real de lote para
    // la misma org — sin transacción, un getDoc de este método podía leer
    // `creditsPurchased` como false justo antes de que el webhook lo pusiera
    // en true, y luego este updateDoc reescribía `limits` completo
    // reintroduciendo maxDrivers, deshaciendo silenciosamente la compra.
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(orgRef);
      const hadCreditsPurchased = purchasingCredits || Boolean(snap.data()?.creditsPurchased);

      const updates = {
        championshipCredits: increment(creditsToAdd),
        updatedAt: new Date().toISOString(),
      };
      if (purchasingCredits) updates.creditsPurchased = true;

      if (newPlan) {
        // Reemplaza el mapa `limits` completo — si esta compra (o alguna
        // anterior, leída dentro de esta misma transacción) ya eliminó el
        // tope de pilotos, se excluye maxDrivers directamente aquí en vez
        // de usar deleteField() sobre 'limits.maxDrivers' (Firestore no
        // permite mezclar un path anidado con su padre 'limits' en el
        // mismo update).
        updates.plan = newPlan;
        updates.aiEnabled = newPlan === 'pro_ia';
        const planLimits = { ...(FirebaseService.PLAN_LIMITS[newPlan] || FirebaseService.PLAN_LIMITS.free) };
        if (hadCreditsPurchased) delete planLimits.maxDrivers;
        updates.limits = planLimits;
      } else if (purchasingCredits) {
        // Sin cambio de plan: solo quitar el tope de pilotos del límite actual.
        updates['limits.maxDrivers'] = deleteField();
      }

      transaction.update(orgRef, updates);
    });
  }

  // ══════════════════════════════════════════
  // Equipamiento (catálogo GLOBAL, gestión exclusiva del Administrador de
  // Plataforma — ver firestore.rules)
  // ══════════════════════════════════════════

  /** Listar productos de equipamiento, ordenados por `order` */
  static async getEquipmentItems() {
    try {
      const q = query(collection(db, 'equipment'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error getting equipment items:', error);
      return [];
    }
  }

  /** Crear un producto de equipamiento */
  static async createEquipmentItem(item, order) {
    try {
      const docRef = await addDoc(collection(db, 'equipment'), {
        ...item,
        order,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating equipment item:', error);
      return { success: false, error: error.message };
    }
  }

  /** Editar un producto de equipamiento existente */
  static async updateEquipmentItem(itemId, updates) {
    try {
      await updateDoc(doc(db, 'equipment', itemId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating equipment item:', error);
      return { success: false, error: error.message };
    }
  }

  /** Eliminar un producto de equipamiento */
  static async deleteEquipmentItem(itemId) {
    try {
      await deleteDoc(doc(db, 'equipment', itemId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting equipment item:', error);
      return { success: false, error: error.message };
    }
  }

  // ══════════════════════════════════════════
  // Alta de organización self-service (Fase 4)
  // ══════════════════════════════════════════

  /** Crear una organización nueva (plan Free) y asignarse 'organizador'.
   *  Requiere sesión iniciada. Ver functions/main.py: create_organization. */
  static async createOrganization(name, slug) {
    if (!auth.currentUser) throw new Error('Debes iniciar sesión');
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/create-organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ name, slug }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Error al crear la organización');
    }
    return data;
  }

  // ══════════════════════════════════════════
  // Sugerencia de resolución de reclamaciones (Gemini)
  // ══════════════════════════════════════════

  /** Pide a Gemini una sugerencia de resolución para un claim, analizando el
   *  video de evidencia (solo YouTube) — ver functions/main.py:
   *  suggest_claim_resolution. Requiere rol de comisario+ en la org del
   *  campeonato. Es una AYUDA, no un fallo automático. */
  static async suggestClaimResolution(championshipId, claimId) {
    if (!auth.currentUser) throw new Error('Debes iniciar sesión');
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/suggest-claim-resolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ championshipId, claimId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Error al pedir la sugerencia');
    }
    return data;
  }
}