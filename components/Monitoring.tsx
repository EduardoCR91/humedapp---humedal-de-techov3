
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, MapPin, PlusCircle, AlertTriangle, X, Check, Bell, ShieldAlert, CloudSun, Wind, RefreshCw, Calendar, Share2, BarChart3, LayoutGrid, List, ChevronDown, ChevronUp, Eye, Trash2, Navigation2, Crosshair, TrendingUp, PieChart as PieChartIcon, Bird, Leaf, Edit2, Plus, Minus } from 'lucide-react';
import L from 'leaflet';
import { Capacitor } from '@capacitor/core';
// Para app nativa, usar el plugin de Geolocation de Capacitor
// Recuerda instalarlo y sincronizar Android:
// npm install @capacitor/geolocation
// npx cap sync android
import { Geolocation } from '@capacitor/geolocation';
import { useMonitoringViewModel } from '../useMonitoringViewModel';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { useNetworkStatus } from './useNetworkStatus';
import { useLanguage } from './LanguageContext';

const Monitoring: React.FC = () => {
  const vm = useMonitoringViewModel();
  const isOnline = useNetworkStatus();
  const { lang } = useLanguage();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [showConfirmSelection, setShowConfirmSelection] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<[number, number] | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [tempMarkerCoords, setTempMarkerCoords] = useState<[number, number] | null>(null);
  const [showStats, setShowStats] = useState(false);

  const [newReportDraft, setNewReportDraft] = useState({ type: 'fauna' as 'fauna' | 'flora' | 'emergency', title: '', description: '' });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});
  const tempMarkerRef = useRef<L.Marker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastReportPreview, setLastReportPreview] = useState<{ title: string; imageUrl: string } | null>(null);
  const [activeReportPreview, setActiveReportPreview] = useState<{ title: string; imageUrl: string; description: string; user: string; date: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);

  // Helper para obtener la ubicación tanto en web como en app nativa
  const getCurrentCoords = async (): Promise<[number, number] | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location === 'denied' || perm.location === 'prompt') {
          await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        return [pos.coords.latitude, pos.coords.longitude];
      }

      if ('geolocation' in navigator) {
        return await new Promise<[number, number]>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
      return null;
    } catch (err) {
      console.warn('Error al obtener ubicación', err);
      return null;
    }
  };

  useEffect(() => {
    vm.fetchWeather();
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([4.642, -74.148], 15);
    mapInstanceRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPendingCoords(coords);
      setShowConfirmSelection(true);
      
      if (tempMarkerRef.current) tempMarkerRef.current.remove();
      tempMarkerRef.current = L.marker(coords, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #059669; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); animation: pulse 1.5s infinite;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    });

    // Intentar centrar el mapa en la ubicación del usuario (web o app nativa)
    getCurrentCoords()
      .then((coords) => {
        if (!coords) return;
        vm.setUserCoords(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(coords, 17);
        }
      })
      .catch((err) => console.warn('Error de geolocalización inicial.', err));

    return () => { 
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    const loadProfile = async () => {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, role')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        if (data.username) {
          setUsername(data.username as string);
        }
        if (data.role === 'admin') {
          setIsAdmin(true);
        }
      }
      setLoadingProfile(false);
    };
    loadProfile().catch(() => setLoadingProfile(false));
  }, [user]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Clear existing markers
    Object.keys(markersRef.current).forEach(key => {
      const marker = markersRef.current[Number(key)];
      if (marker) marker.remove();
    });
    markersRef.current = {};

    // Add new styled markers
    vm.filteredReports.forEach(r => {
      const config = {
        fauna: { color: '#3b82f6', icon: '🐦' },
        flora: { color: '#10b981', icon: '🌱' },
        emergency: { color: '#ef4444', icon: '⚠️' }
      }[r.type] || { color: '#6b7280', icon: '📍' };

      const markerIcon = L.divIcon({
        className: 'custom-report-marker',
        html: `
          <div style="
            background-color: ${config.color};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            <div style="transform: rotate(45deg); font-size: 16px;">${config.icon}</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      markersRef.current[r.id] = L.marker(r.coords, { icon: markerIcon })
        .addTo(mapInstanceRef.current!)
        .bindPopup(`
          <div style="min-width: 120px; font-family: 'Inter', sans-serif; padding: 4px;">
            <div style="font-weight: 800; color: #064e3b; margin-bottom: 2px; font-size: 13px;">${r.title}</div>
            <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">${r.type === 'emergency' ? 'Riesgo' : r.type}</div>
          </div>
        `);
    });
  }, [vm.filteredReports]);

  const handleLocate = async () => {
    const coords = await getCurrentCoords();
    if (!coords) {
      alert(
        lang === 'en'
          ? 'Location is not available. Please check GPS permissions on your device.'
          : 'La ubicación no está disponible. Revisa los permisos de GPS en tu dispositivo.'
      );
      return;
    }
    vm.setUserCoords(coords);
    mapInstanceRef.current?.setView(coords, 17);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const confirmMapSelection = () => {
    if (pendingCoords) {
      setTempMarkerCoords(pendingCoords);
      setIsReporting(true);
      setShowConfirmSelection(false);
      setPendingCoords(null);
    }
  };

  const cancelMapSelection = () => {
    setShowConfirmSelection(false);
    setPendingCoords(null);
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  };

  const handleOnSubmit = () => {
    if (!newReportDraft.title) return;
    if (!isOnline) {
      alert(
        lang === 'en'
          ? 'You cannot create or edit reports while you are offline.'
          : 'No puedes crear o editar reportes mientras estás sin conexión.'
      );
      return;
    }
    if (!username) {
      alert(
        lang === 'en'
          ? 'Your username was not found. Please complete your profile and try again.'
          : 'No se encontró tu nombre de usuario. Completa tu perfil e intenta de nuevo.'
      );
      return;
    }
    const finalCoords = tempMarkerCoords || vm.userCoords || [4.642, -74.148];
    const finalImage = capturedImage || `https://picsum.photos/seed/${Date.now()}/400/300`;

    if (editingReportId) {
      vm.updateReport(editingReportId, {
        title: newReportDraft.title,
        description: newReportDraft.description,
        type: newReportDraft.type,
        coords: finalCoords,
        imageUrl: finalImage,
      });
    } else {
      vm.addReport(
        {
          ...newReportDraft,
          coords: finalCoords,
          imageUrl: finalImage,
        },
        username,
        user.id
      );
    }

    setIsReporting(false);
    setEditingReportId(null);
    setNewReportDraft({ type: 'fauna', title: '', description: '' });
    setCapturedImage(null);
    setTempMarkerCoords(null);
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    stopCamera();
    setLastReportPreview({ title: newReportDraft.title, imageUrl: finalImage });
    setShowConfirmation(true);
  };

  const getSlices = () => {
    const total = vm.stats.total || 1;
    const slices = [
      { value: vm.stats.fauna, color: '#3b82f6', label: 'Fauna' },
      { value: vm.stats.flora, color: '#10b981', label: 'Flora' },
      { value: vm.stats.emergency, color: '#ef4444', label: 'Riesgo' }
    ];

    let cumulativePercent = 0;
    return slices.map(slice => {
      const startPercent = cumulativePercent;
      const percent = slice.value / total;
      cumulativePercent += percent;

      const [startX, startY] = getCoordinatesForPercent(startPercent);
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
      const largeArcFlag = percent > 0.5 ? 1 : 0;

      const pathData = [
        `M 10 10`,
        `L ${startX} ${startY}`,
        `A 10 10 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        `Z`,
      ].join(' ');

      return { pathData, color: slice.color, label: slice.label, value: slice.value };
    });
  };

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [10 + x * 10, 10 + y * 10];
  };

  const { pagedReports, totalLimited } = useMemo(() => {
    const ordered = [...vm.filteredReports].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const limited = ordered.slice(0, 15);
    const start = page * 5;
    const pageItems = limited.slice(start, start + 5);
    return { pagedReports: pageItems, totalLimited: limited.length };
  }, [vm.filteredReports, page]);

  const canPrev = page > 0;
  const canNext = (page + 1) * 5 < totalLimited;

  const startCamera = () => {
    setCapturedImage(null);
    setShowCamera(true);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Si el video aún no reporta dimensiones, usamos un tamaño por defecto
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imgData);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    const setupStream = async () => {
      if (!showCamera) return;

      const isSecure =
        (window as any).isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        alert(
          'La cámara solo funciona en conexiones seguras (https o localhost). Abre la app en https o usa localhost.'
        );
        setShowCamera(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso directo a la cámara.');
        setShowCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(err => {
              console.warn('No se pudo reproducir el video de la cámara:', err);
            });
          }
        }
      } catch (err) {
        console.error('Error accediendo a la cámara:', err);
        const error = err as DOMException;
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          alert(
            'El navegador bloqueó el acceso a la cámara. Ve a la barra de direcciones y permite el uso de la cámara para localhost.'
          );
        } else if (error.name === 'NotFoundError') {
          alert('No se encontró ninguna cámara disponible en este dispositivo.');
        } else {
          alert('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        }
        setShowCamera(false);
      }
    };

    setupStream().catch(() => setShowCamera(false));
  }, [showCamera]);

  return (
    <div className="p-4 animate-fadeIn pb-24 relative">

      {!isOnline && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
          {lang === 'en'
            ? 'You are offline. You can review reports already loaded if available, but you cannot create, edit or delete reports until you reconnect.'
            : 'Estás sin conexión. Puedes revisar reportes ya cargados si están disponibles, pero no podrás crear, editar ni eliminar reportes hasta recuperar la conexión.'}
        </p>
      )}

      <section className="bg-emerald-800 text-white rounded-3xl p-5 mb-6 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CloudSun size={20} className="text-emerald-100" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {lang === 'en' ? 'Techo Wetland' : 'Humedal de Techo'}
            </span>
            <button onClick={vm.fetchWeather} className={`ml-auto ${vm.loadingWeather ? 'animate-spin' : ''}`}><RefreshCw size={14}/></button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><span className="text-2xl font-bold">{vm.weather?.temp || '--'}°</span><p className="text-[10px] text-emerald-200">Temp</p></div>
            <div><span className="text-2xl font-bold">{vm.weather?.humidity || '--'}%</span><p className="text-[10px] text-emerald-200">{lang === 'en' ? 'Humidity' : 'Humedad'}</p></div>
            <div><span className="text-2xl font-bold">{vm.weather?.wind || '--'}</span><p className="text-[10px] text-emerald-200">{lang === 'en' ? 'Wind' : 'Viento'}</p></div>
          </div>
        </div>
      </section>

      <div className="relative mb-6">
        <div className="bg-gray-100 h-64 rounded-3xl relative overflow-hidden border border-emerald-50 shadow-inner z-0">
          <div ref={mapContainerRef} className="w-full h-full" />
          <button 
            onClick={handleLocate} 
            className="absolute top-4 left-4 z-[400] bg-white p-2.5 rounded-xl shadow-lg text-emerald-600 active:scale-90 transition-all border border-emerald-50"
          >
            <Navigation2 size={20} fill={vm.userCoords ? "currentColor" : "none"} />
          </button>
          <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="bg-white p-2 rounded-xl shadow-md border border-emerald-50 text-emerald-700 active:scale-95"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="bg-white p-2 rounded-xl shadow-md border border-emerald-50 text-emerald-700 active:scale-95"
            >
              <Minus size={16} />
            </button>
          </div>
        </div>

        {showConfirmSelection && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center p-4 bg-emerald-900/10 backdrop-blur-[2px] rounded-3xl overflow-hidden animate-fadeIn">
            <div className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 w-full max-w-[200px] border border-emerald-100 animate-slideUp">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                  <MapPin size={20} />
                </div>
                <p className="text-[10px] font-bold text-center text-emerald-900 uppercase tracking-tight">¿Reportar en este punto?</p>
                <div className="flex gap-2 w-full">
                  <button onClick={confirmMapSelection} className="flex-1 bg-emerald-600 text-white p-2 rounded-lg shadow-md active:scale-90 transition-transform"><Check size={18} className="mx-auto" /></button>
                  <button onClick={cancelMapSelection} className="flex-1 bg-white text-gray-400 p-2 rounded-lg border border-gray-100 active:scale-90 transition-transform"><X size={18} className="mx-auto" /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="mb-6 animate-fadeIn text-black">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-black flex items-center gap-2">
            <BarChart3 size={20} className="text-black" />
            {lang === 'en' ? 'Distribution of reports' : 'Distribución de Reportes'}
          </h3>
          <button 
            onClick={() => setShowStats(!showStats)} 
            className="text-xs font-bold text-emerald-900 uppercase tracking-widest flex items-center gap-1"
          >
            {showStats ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {showStats ? (lang === 'en' ? 'Hide': 'Ocultar') : (lang === 'en' ? 'Show' : 'Ver Detalle')}
          </button>
        </div>

        {showStats && (
          <div className="bg-white p-6 rounded-3xl border border-emerald-50 shadow-sm flex flex-col items-center gap-6 animate-fadeIn">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 20 20" className="w-full h-full transform -rotate-90">
                {getSlices().map((slice, i) => (
                  <path key={i} d={slice.pathData} fill={slice.color} className="transition-all hover:opacity-80 cursor-pointer" />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-black text-emerald-900">{vm.stats.total}</span>
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Total</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full">
              {[
                { label: lang === 'en' ? 'Fauna' : 'Fauna', color: 'bg-blue-500', value: vm.stats.fauna },
                { label: lang === 'en' ? 'Flora' : 'Flora', color: 'bg-emerald-500', value: vm.stats.flora },
                { label: lang === 'en' ? 'Risk' : 'Riesgo', color: 'bg-red-500', value: vm.stats.emergency },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`w-3 h-3 ${item.color} rounded-full mb-2 shadow-sm`} />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{item.label}</span>
                  <span className="text-sm font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {['all', 'fauna', 'flora', 'riesgo'].map(f => (
            <button
              key={f}
              onClick={() => vm.setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
                vm.activeFilter === f
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white text-emerald-600 border border-emerald-100'
              }`}
            >
              {f === 'all'
                ? lang === 'en'
                  ? 'All'
                  : 'Todos'
                : f === 'riesgo'
                ? lang === 'en'
                  ? 'Risk'
                  : 'Riesgo'
                : f}
            </button>
          ))}
        </div>

        {totalLimited > 0 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="text-[11px] font-semibold text-font-black disabled:text-font-black"
            >
              {lang === 'en' ? 'Latest reports' : 'Últimos reportes'}
            </button>
            <button
              onClick={() => canPrev && setPage(p => p - 1)}
              disabled={!canPrev}
              className="px-3 py-1 rounded-full text-[11px] border border-emerald-100 text-font-black disabled:text-font-black disabled:border-gray-200"
            >{lang === 'en' ? 'Previous' : 'Anterior'}
              
            </button>
            <button
              onClick={() => canNext && setPage(p => p + 1)}
              disabled={!canNext}
              className="px-3 py-1 rounded-full text-[11px] border border-emerald-100 text-font-black disabled:text-gray-300 disabled:border-gray-200"
            >{lang === 'en' ? 'Next' : 'Siguiente'}
              
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
        {pagedReports.map(report => {
          const isOwner =
            (!!report.ownerId && !!user && report.ownerId === user.id) ||
            (!!username && report.user === `@${username}`);
          const canEdit = isOwner;
          const canDelete = isAdmin;

          return (
            <div
              key={report.id}
              className={`bg-white p-4 rounded-2xl border transition-all ${
                selectedReportId === report.id
                  ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                  : 'border-emerald-50 shadow-sm'
              }`}
            >
              <div className="flex justify-between gap-4">
                <button
                  className="flex gap-4 text-left flex-1"
                  onClick={() => {
                    setSelectedReportId(report.id);
                    mapInstanceRef.current?.setView(report.coords, 17, { animate: true });
                    setActiveReportPreview({
                      title: report.title,
                      imageUrl: report.imageUrl,
                      description: report.description,
                      user: report.user,
                      date: report.date,
                    });
                  }}
                >
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      report.type === 'fauna'
                        ? 'bg-blue-50 text-blue-600'
                        : report.type === 'emergency'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {report.type === 'fauna' ? (
                      <Bird size={20} />
                    ) : report.type === 'emergency' ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <Leaf size={20} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm">{report.title}</h4>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                      {report.user} • {report.date}
                    </p>
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingReportId(report.id);
                        setNewReportDraft({
                          type: report.type,
                          title: report.title,
                          description: report.description,
                        });
                        setTempMarkerCoords(report.coords);
                        setIsReporting(true);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Edit2 size={14} />
                      {lang === 'en'
                        ? 'Edit'
                        : 'Editar'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            '¿Seguro que deseas eliminar este reporte? Esta acción no se puede deshacer.'
                          )
                        ) {
                          vm.deleteReport(report.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      {lang === 'en'
                        ? 'Delete'
                        : 'Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-24 right-6 flex flex-col gap-4 z-40">
        <button 
          onClick={() => { setIsReporting(true); setTempMarkerCoords(null); }} 
          className="bg-emerald-600 text-white px-4 py-3 rounded-full shadow-2xl active:scale-95 transition-all hover:bg-emerald-700 flex items-center gap-2"
        >
          <PlusCircle size={20}/>
          <span className="text-xs font-semibold uppercase tracking-wide">Reportar</span>
        </button>
      </div>

      {isReporting && (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-end p-4">
          <div className="bg-white w-full rounded-t-[2.5rem] rounded-b-3xl p-6 shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-emerald-900">Nuevo Reporte</h3>
              <button onClick={() => { setIsReporting(false); setCapturedImage(null); stopCamera(); }} className="p-2 text-gray-400"><X size={24}/></button>
            </div>
            
            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Evidencia Visual</label>
              {!capturedImage && !showCamera && (
                <button onClick={startCamera} className="w-full aspect-video rounded-3xl border-2 border-dashed border-emerald-100 bg-emerald-50/30 flex flex-col items-center justify-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <Camera size={32} />
                  <span className="text-xs font-bold">Tomar Foto</span>
                </button>
              )}
              {showCamera && (
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-inner">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button onClick={capturePhoto} className="bg-white text-emerald-600 p-3 rounded-full shadow-xl active:scale-90 transition-transform"><Check size={24} /></button>
                    <button onClick={stopCamera} className="bg-red-500 text-white p-3 rounded-full shadow-xl active:scale-90 transition-transform"><X size={24} /></button>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-md">
                  <img src={capturedImage} className="w-full h-full object-cover" alt="Captura" />
                  <button onClick={() => setCapturedImage(null)} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"><Trash2 size={16} /></button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            {(tempMarkerCoords || vm.userCoords) && (
              <div className="mb-6 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-4">
                 <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm"><MapPin size={20} /></div>
                 <div className="flex-1">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">{tempMarkerCoords ? 'Punto Seleccionado' : 'Tu Ubicación Actual'}</span>
                    <span className="text-xs text-emerald-600 font-bold">{(tempMarkerCoords || vm.userCoords)![0].toFixed(5)}, {(tempMarkerCoords || vm.userCoords)![1].toFixed(5)}</span>
                 </div>
                 {tempMarkerCoords && <button onClick={() => setTempMarkerCoords(null)} className="text-emerald-300 hover:text-red-500"><Trash2 size={18} /></button>}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">¿Qué observaste?</label>
                <input 
                  type="text" 
                  placeholder="Ej: Avistamiento de Tingua Azul" 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                  onChange={e => setNewReportDraft(prev => ({...prev, title: e.target.value}))}
                  value={newReportDraft.title}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['fauna', 'flora', 'emergency'] as const).map(type => (
                  <button 
                    key={type}
                    onClick={() => setNewReportDraft(prev => ({...prev, type}))}
                    className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${newReportDraft.type === type ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-400 border-gray-100'}`}
                  >
                    {type === 'emergency' ? 'Riesgo' : type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleOnSubmit}
              disabled={!newReportDraft.title}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl disabled:opacity-50 active:scale-95 transition-all"
            >
              Enviar Reporte
            </button>
          </div>
        </div>
      )}

      {showConfirmation && lastReportPreview && (
        <div className="fixed inset-0 z-[2100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-emerald-900">Reporte guardado</h4>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-3 bg-gray-100">
              <img
                src={lastReportPreview.imageUrl}
                alt="Evidencia del reporte"
                className="w-full h-40 object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mb-1">Título del reporte</p>
            <p className="text-sm font-semibold text-gray-800">
              {lastReportPreview.title || 'Reporte sin título'}
            </p>
            <button
              onClick={() => setShowConfirmation(false)}
              className="mt-4 w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {activeReportPreview && (
        <div className="fixed inset-0 z-[2200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-emerald-900">Detalle del reporte</h4>
              <button
                onClick={() => setActiveReportPreview(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-3 bg-gray-100">
              <img
                src={activeReportPreview.imageUrl}
                alt="Evidencia del reporte"
                className="w-full h-52 object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {activeReportPreview.user} • {activeReportPreview.date}
            </p>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {activeReportPreview.title}
            </p>
            {activeReportPreview.description && (
              <p className="text-xs text-gray-600">
                {activeReportPreview.description}
              </p>
            )}
            <button
              onClick={() => setActiveReportPreview(null)}
              className="mt-4 w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Ensure popup styles are consistent */
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
        }
        .leaflet-popup-tip {
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};

export default Monitoring;
