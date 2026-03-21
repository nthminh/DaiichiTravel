import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FirebaseStorage } from 'firebase/storage';
import { transportService } from '../services/transportService';
import { Route, RouteStop, PricePeriod, RouteSurcharge } from '../types';
import { compressImage } from '../lib/imageUtils';

/** External dependencies that useRoutes needs from App.tsx */
export interface RouteContext {
  routes: Route[];
  language: 'vi' | 'en' | 'ja';
  storage: FirebaseStorage | null;
}

const STOP_ID_DEPARTURE = '__departure__';
const STOP_ID_ARRIVAL = '__arrival__';

export const DEFAULT_ROUTE_FORM = {
  stt: 1,
  name: '',
  departurePoint: '',
  arrivalPoint: '',
  price: 0,
  agentPrice: 0,
  duration: '',
  details: '',
  imageUrl: '',
  images: [] as string[],
  vehicleImageUrl: '',
  disablePickupAddress: false,
  disablePickupAddressFrom: '',
  disablePickupAddressTo: '',
  disableDropoffAddress: false,
  disableDropoffAddressFrom: '',
  disableDropoffAddressTo: '',
};

type RouteFareEntry = {
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
  price: number;
  agentPrice: number;
  startDate: string;
  endDate: string;
};

/**
 * useRoutes – encapsulates all route CRUD state and handlers.
 *
 * Usage:
 *   const routesHook = useRoutes(ctx);
 *   // ctx must contain up-to-date routes[], storage, and language every render.
 */
export function useRoutes(ctx: RouteContext) {
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [isCopyingRoute, setIsCopyingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ ...DEFAULT_ROUTE_FORM });
  const [routePricePeriods, setRoutePricePeriods] = useState<PricePeriod[]>([]);
  const [showAddPricePeriod, setShowAddPricePeriod] = useState(false);
  const [pricePeriodForm, setPricePeriodForm] = useState({
    name: '',
    price: 0,
    agentPrice: 0,
    startDate: '',
    endDate: '',
  });
  const [editingPricePeriodId, setEditingPricePeriodId] = useState<string | null>(null);
  const [routeSurcharges, setRouteSurcharges] = useState<RouteSurcharge[]>([]);
  const [showAddRouteSurcharge, setShowAddRouteSurcharge] = useState(false);
  const [routeSurchargeForm, setRouteSurchargeForm] = useState<
    Omit<RouteSurcharge, 'id' | 'amount'> & { amount: number | '' }
  >({ name: '', type: 'FUEL', amount: '', isActive: true });
  const [editingRouteSurchargeId, setEditingRouteSurchargeId] = useState<string | null>(null);

  // Route stops (intermediate stops for a route)
  const [routeFormStops, setRouteFormStops] = useState<RouteStop[]>([]);
  const routeFormStopsRef = useRef<RouteStop[]>([]);
  useEffect(() => {
    routeFormStopsRef.current = routeFormStops;
  }, [routeFormStops]);

  // Ref to track current routeForm values (used in async handlers to resolve stop names)
  const routeFormRef = useRef(routeForm);
  useEffect(() => {
    routeFormRef.current = routeForm;
  }, [routeForm]);

  // All route stops including auto-generated departure/arrival entries.
  const allRouteStops: RouteStop[] = useMemo(
    () => [
      ...(routeForm.departurePoint
        ? [{ stopId: STOP_ID_DEPARTURE, stopName: routeForm.departurePoint, order: 0 }]
        : []),
      ...[...routeFormStops].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 })),
      ...(routeForm.arrivalPoint
        ? [
            {
              stopId: STOP_ID_ARRIVAL,
              stopName: routeForm.arrivalPoint,
              order: routeFormStops.length + 1,
            },
          ]
        : []),
    ],
    [routeForm.departurePoint, routeForm.arrivalPoint, routeFormStops],
  );

  const [showAddRouteStop, setShowAddRouteStop] = useState(false);
  const [editingRouteStop, setEditingRouteStop] = useState<RouteStop | null>(null);
  const [routeStopForm, setRouteStopForm] = useState({ stopId: '', stopName: '', order: 1 });

  // Undo history for route stop list and fare list
  const [routeFormStopsHistory, setRouteFormStopsHistory] = useState<RouteStop[][]>([]);
  const [routeFormFaresHistory, setRouteFormFaresHistory] = useState<RouteFareEntry[][]>([]);

  // Fare table for route (retail + agent price per segment)
  const [routeFormFares, setRouteFormFares] = useState<RouteFareEntry[]>([]);
  // Tracks the fareDocIds that exist in Firestore for the route being edited.
  const originalFareDocIdsRef = useRef<Set<string>>(new Set());
  const [showAddRouteFare, setShowAddRouteFare] = useState(false);
  const [editingRouteFareIdx, setEditingRouteFareIdx] = useState<number | null>(null);
  const [routeFareForm, setRouteFareForm] = useState({
    fromStopId: '',
    toStopId: '',
    price: 0,
    agentPrice: 0,
    startDate: '',
    endDate: '',
  });

  const [routeImageUploading, setRouteImageUploading] = useState(false);

  // Saving / error state for route save operations
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [routeSaveError, setRouteSaveError] = useState<string | null>(null);

  // Keep a stable ref for async handlers to read the latest context.
  const ctxRef = useRef<RouteContext>(ctx);
  ctxRef.current = ctx;

  const handleSaveRoute = async () => {
    setIsSavingRoute(true);
    setRouteSaveError(null);
    try {
      const intermediateStops = [...routeFormStopsRef.current]
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({ ...s, order: i + 1 }));
      const currentForm = routeFormRef.current;
      const fullRouteStops: RouteStop[] = [
        ...(currentForm.departurePoint
          ? [{ stopId: '__departure__', stopName: currentForm.departurePoint, order: 0 }]
          : []),
        ...intermediateStops,
        ...(currentForm.arrivalPoint
          ? [
              {
                stopId: '__arrival__',
                stopName: currentForm.arrivalPoint,
                order: intermediateStops.length + 1,
              },
            ]
          : []),
      ];
      const routeData = {
        ...currentForm,
        pricePeriods: routePricePeriods,
        surcharges: routeSurcharges,
        routeStops: fullRouteStops,
      };
      let routeId = editingRoute?.id;
      if (editingRoute) {
        await transportService.updateRoute(editingRoute.id, routeData);
      } else {
        const docRef = await transportService.addRoute(routeData);
        routeId = docRef?.id;
      }
      if (routeId) {
        // Capture fare list at save time (avoid closure issues with async loops)
        const faresSnapshot = routeFormFares.slice();
        for (let fareIdx = 0; fareIdx < faresSnapshot.length; fareIdx++) {
          const fare = faresSnapshot[fareIdx];
          try {
            await transportService.upsertFare(
              routeId,
              fare.fromStopId,
              fare.toStopId,
              fare.price,
              fare.agentPrice > 0 ? fare.agentPrice : undefined,
              'VND',
              fare.startDate || undefined,
              fare.endDate || undefined,
              fareIdx,
            );
          } catch (err) {
            console.error('Failed to save fare:', fare, err);
          }
        }
        const currentFareDocIds = new Set(
          faresSnapshot.map(f => `${f.fromStopId}_${f.toStopId}`),
        );
        for (const originalId of originalFareDocIdsRef.current) {
          if (!currentFareDocIds.has(originalId)) {
            try {
              await transportService.deleteFare(routeId, originalId);
            } catch (err) {
              console.error('Failed to delete fare:', originalId, err);
            }
          }
        }
        originalFareDocIdsRef.current = new Set();
      }
      setShowAddRoute(false);
      setEditingRoute(null);
      setIsCopyingRoute(false);
      setRouteForm({ ...DEFAULT_ROUTE_FORM });
    } catch (err: any) {
      console.error('Failed to save route:', err);
      const lang = ctxRef.current.language;
      setRouteSaveError(
        lang === 'vi'
          ? `Lưu thất bại: ${err?.message || 'Vui lòng thử lại.'}`
          : `Save failed: ${err?.message || 'Please try again.'}`,
      );
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleRouteImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { storage } = ctxRef.current;
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !storage) {
      if (!storage) alert('Firebase Storage is not configured.');
      return;
    }
    setRouteImageUploading(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file, 0.75, 1280);
        const sRef = storageRef(storage, `routes/${Date.now()}_${compressed.name}`);
        const task = uploadBytesResumable(sRef, compressed, { contentType: 'image/jpeg' });
        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            undefined,
            err => {
              console.error('Upload error:', err);
              reject(err);
            },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              urls.push(url);
              resolve();
            },
          );
        });
      }
      setRouteForm(prev => {
        const combined = [...(prev.images || []), ...urls];
        return { ...prev, images: combined, imageUrl: combined[0] || '' };
      });
    } catch (err) {
      console.error('Route image upload failed:', err);
      alert('Upload failed. Please check your Firebase configuration.');
    } finally {
      setRouteImageUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (
      !window.confirm(
        ctxRef.current.language === 'vi'
          ? 'Bạn có chắc muốn xóa tuyến này?'
          : 'Delete this route?',
      )
    )
      return;
    try {
      await transportService.deleteRoute(routeId);
    } catch (err) {
      console.error('Failed to delete route:', err);
    }
  };

  const handleStartEditRoute = (route: Route) => {
    setEditingRoute(route);
    setIsCopyingRoute(false);
    setRouteSaveError(null);
    const loadedStops = (route.routeStops || [])
      .filter(s => s.stopId !== '__departure__' && s.stopId !== '__arrival__')
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setRouteForm({
      stt: route.stt,
      name: route.name,
      departurePoint: route.departurePoint,
      arrivalPoint: route.arrivalPoint,
      price: route.price,
      agentPrice: route.agentPrice || 0,
      duration: route.duration || '',
      details: route.details || '',
      imageUrl: route.imageUrl || '',
      images: route.images || [],
      vehicleImageUrl: route.vehicleImageUrl || '',
      disablePickupAddress: route.disablePickupAddress || false,
      disablePickupAddressFrom: route.disablePickupAddressFrom || '',
      disablePickupAddressTo: route.disablePickupAddressTo || '',
      disableDropoffAddress: route.disableDropoffAddress || false,
      disableDropoffAddressFrom: route.disableDropoffAddressFrom || '',
      disableDropoffAddressTo: route.disableDropoffAddressTo || '',
    });
    setRoutePricePeriods(route.pricePeriods || []);
    setRouteSurcharges(route.surcharges || []);
    setShowAddPricePeriod(false);
    setEditingPricePeriodId(null);
    setShowAddRouteSurcharge(false);
    setEditingRouteSurchargeId(null);
    setRouteFormStops(loadedStops);
    setShowAddRouteStop(false);
    // Reset fares and original IDs before loading – prevents stale data from a
    // previous edit session being used if the user re-opens the same route.
    setRouteFormFares([]);
    originalFareDocIdsRef.current = new Set();
    setShowAddRouteFare(false);
    setEditingRouteFareIdx(null);
    setRouteFormStopsHistory([]);
    setRouteFormFaresHistory([]);
    setShowAddRoute(true);
    // One-time fetch of fares (replaces the real-time subscription that was
    // previously used here).  A real-time listener would continuously overwrite
    // any local edits the user makes in the fare table, causing apparent data
    // loss.  A single fetch is sufficient: the admin is the only writer while
    // the modal is open.
    if (route.id) {
      const allStops = [
        ...(route.departurePoint
          ? [{ stopId: STOP_ID_DEPARTURE, stopName: route.departurePoint }]
          : []),
        ...loadedStops,
        ...(route.arrivalPoint
          ? [{ stopId: STOP_ID_ARRIVAL, stopName: route.arrivalPoint }]
          : []),
      ];
      transportService
        .getRouteFares(route.id)
        .then(fares => {
          const activeFares = fares.filter(f => f.active !== false);
          originalFareDocIdsRef.current = new Set(
            activeFares.map(f => `${f.fromStopId}_${f.toStopId}`),
          );
          setRouteFormFares(
            activeFares.map(f => ({
              fromStopId: f.fromStopId,
              toStopId: f.toStopId,
              fromName: allStops.find(s => s.stopId === f.fromStopId)?.stopName || f.fromStopId,
              toName: allStops.find(s => s.stopId === f.toStopId)?.stopName || f.toStopId,
              price: f.price,
              agentPrice: f.agentPrice || 0,
              startDate: f.startDate || '',
              endDate: f.endDate || '',
            })),
          );
        })
        .catch(err => {
          console.error('Failed to load route fares for edit:', err);
          const lang = ctxRef.current.language;
          setRouteSaveError(
            lang === 'vi'
              ? 'Không thể tải bảng giá vé. Vui lòng đóng và mở lại để thử lại.'
              : 'Could not load fare table. Please close and reopen to try again.',
          );
        });
    }
  };

  const handleCopyRoute = (route: Route) => {
    const { language, routes } = ctxRef.current;
    setEditingRoute(null);
    setIsCopyingRoute(true);
    const copySuffix =
      language === 'vi' ? ' (bản sao)' : language === 'ja' ? '（コピー）' : ' (copy)';
    const copiedName = `${route.name}${copySuffix}`;
    setRouteForm({
      stt: routes.length + 1,
      name: copiedName,
      departurePoint: route.departurePoint,
      arrivalPoint: route.arrivalPoint,
      price: route.price,
      agentPrice: route.agentPrice || 0,
      duration: route.duration || '',
      details: route.details || '',
      imageUrl: route.imageUrl || '',
      images: route.images || [],
      vehicleImageUrl: route.vehicleImageUrl || '',
      disablePickupAddress: route.disablePickupAddress || false,
      disablePickupAddressFrom: route.disablePickupAddressFrom || '',
      disablePickupAddressTo: route.disablePickupAddressTo || '',
      disableDropoffAddress: route.disableDropoffAddress || false,
      disableDropoffAddressFrom: route.disableDropoffAddressFrom || '',
      disableDropoffAddressTo: route.disableDropoffAddressTo || '',
    });
    const now = Date.now();
    setRoutePricePeriods((route.pricePeriods || []).map((p, i) => ({ ...p, id: `pp_${now}_${i}` })));
    setRouteSurcharges(
      (route.surcharges || []).map((s, i) => ({ ...s, id: `sc_${now}_${i}` })),
    );
    const loadedStops = (route.routeStops || [])
      .filter(s => s.stopId !== '__departure__' && s.stopId !== '__arrival__')
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setRouteFormStops(loadedStops);
    setShowAddPricePeriod(false);
    setEditingPricePeriodId(null);
    setShowAddRouteSurcharge(false);
    setEditingRouteSurchargeId(null);
    setShowAddRouteStop(false);
    setRouteFormFares([]);
    originalFareDocIdsRef.current = new Set();
    setShowAddRouteFare(false);
    setEditingRouteFareIdx(null);
    setRouteFormStopsHistory([]);
    setRouteFormFaresHistory([]);
    if (route.id) {
      transportService
        .getRouteFares(route.id)
        .then(fares => {
          const allStops = [
            ...(route.departurePoint
              ? [{ stopId: '__departure__', stopName: route.departurePoint }]
              : []),
            ...loadedStops,
            ...(route.arrivalPoint
              ? [{ stopId: '__arrival__', stopName: route.arrivalPoint }]
              : []),
          ];
          setRouteFormFares(
            fares
              .filter(f => f.active !== false)
              .map(f => ({
                fromStopId: f.fromStopId,
                toStopId: f.toStopId,
                fromName:
                  allStops.find(s => s.stopId === f.fromStopId)?.stopName || f.fromStopId,
                toName: allStops.find(s => s.stopId === f.toStopId)?.stopName || f.toStopId,
                price: f.price,
                agentPrice: f.agentPrice || 0,
                startDate: f.startDate || '',
                endDate: f.endDate || '',
              })),
          );
        })
        .catch(err => {
          console.error('Failed to load route fares for copy:', err);
        });
    }
    setShowAddRoute(true);
  };

  const handleSaveRouteNote = async (routeId: string, note: string) => {
    try {
      await transportService.updateRoute(routeId, { note });
    } catch (err) {
      console.error('Failed to save route note:', err);
    }
  };

  return {
    showAddRoute,
    setShowAddRoute,
    editingRoute,
    setEditingRoute,
    isCopyingRoute,
    setIsCopyingRoute,
    routeForm,
    setRouteForm,
    routePricePeriods,
    setRoutePricePeriods,
    showAddPricePeriod,
    setShowAddPricePeriod,
    pricePeriodForm,
    setPricePeriodForm,
    editingPricePeriodId,
    setEditingPricePeriodId,
    routeSurcharges,
    setRouteSurcharges,
    showAddRouteSurcharge,
    setShowAddRouteSurcharge,
    routeSurchargeForm,
    setRouteSurchargeForm,
    editingRouteSurchargeId,
    setEditingRouteSurchargeId,
    routeFormStops,
    setRouteFormStops,
    routeFormStopsRef,
    routeFormRef,
    allRouteStops,
    showAddRouteStop,
    setShowAddRouteStop,
    editingRouteStop,
    setEditingRouteStop,
    routeStopForm,
    setRouteStopForm,
    routeFormStopsHistory,
    setRouteFormStopsHistory,
    routeFormFaresHistory,
    setRouteFormFaresHistory,
    routeFormFares,
    setRouteFormFares,
    originalFareDocIdsRef,
    showAddRouteFare,
    setShowAddRouteFare,
    editingRouteFareIdx,
    setEditingRouteFareIdx,
    routeFareForm,
    setRouteFareForm,
    routeImageUploading,
    isSavingRoute,
    routeSaveError,
    setRouteSaveError,
    handleSaveRoute,
    handleRouteImageUpload,
    handleDeleteRoute,
    handleStartEditRoute,
    handleCopyRoute,
    handleSaveRouteNote,
  };
}
