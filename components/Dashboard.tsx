
import React, { useEffect, useState, useRef } from 'react';
import { AppTab } from '../types';
import {
  Sun,
  Wind,
  Droplets,
  Eye,
  Bird,
  Leaf,
  ChevronRight,
  Newspaper,
  PlusCircle,
  Image as ImageIcon,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

interface DashboardProps {
  setActiveTab: (tab: AppTab) => void;
}

interface NewsItem {
  id: string | number;
  title: string;
  summary: string;
  image_url?: string | null;
  published_at?: string | null;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsImagePreview, setNewsImagePreview] = useState<string | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<string | number | null>(null);
  const [savingNews, setSavingNews] = useState(false);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);
  const [showNewsCamera, setShowNewsCamera] = useState(false);
  const newsVideoRef = useRef<HTMLVideoElement | null>(null);
  const newsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    const loadNews = async () => {
      try {
        if (!navigator.onLine) {
          const cached = window.localStorage.getItem('ecovigia_news');
          if (cached) {
            setNews(JSON.parse(cached));
          }
          return;
        }

        const { data, error } = await supabase
          .from('news')
          .select('id, title, summary, image_url, published_at')
          .order('published_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          const items = data as NewsItem[];
          setNews(items);
          try {
            window.localStorage.setItem('ecovigia_news', JSON.stringify(items));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore fetch errors, se usará caché si existe
      }
    };

    loadNews().catch(() => {
      // Silenciar errores en UI; se puede loguear si es necesario
    });
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    };
    loadRole().catch(() => undefined);
  }, [user]);

  const startNewsCamera = () => {
    setShowNewsCamera(true);
  };

  const stopNewsCamera = () => {
    if (newsVideoRef.current && newsVideoRef.current.srcObject) {
      const tracks = (newsVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      newsVideoRef.current.srcObject = null;
    }
    setShowNewsCamera(false);
  };

  const captureNewsPhoto = () => {
    if (newsVideoRef.current && newsCanvasRef.current) {
      const video = newsVideoRef.current;
      const canvas = newsCanvasRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = canvas.toDataURL('image/jpeg');
        setNewsImagePreview(imgData);
        stopNewsCamera();
      }
    }
  };

  useEffect(() => {
    const setupNewsStream = async () => {
      if (!showNewsCamera) return;

      const isSecure =
        (window as any).isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        alert(
          'La cámara solo funciona en conexiones seguras (https o localhost). Abre la app en https o usa localhost.'
        );
        setShowNewsCamera(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso directo a la cámara.');
        setShowNewsCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        const video = newsVideoRef.current;
        if (video) {
          video.srcObject = stream;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(err => {
              console.warn('No se pudo reproducir el video de la cámara para noticias:', err);
            });
          }
        }
      } catch (err) {
        console.error('Error accediendo a la cámara para noticias:', err);
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
        setShowNewsCamera(false);
      }
    };

    setupNewsStream().catch(() => undefined);

    return () => {
      if (showNewsCamera) {
        if (newsVideoRef.current && newsVideoRef.current.srcObject) {
          const tracks = (newsVideoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
        }
      }
    };
  }, [showNewsCamera]);

  const handleNewsImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(
        lang === 'en'
          ? 'Please select a valid image for the news item.'
          : 'Por favor selecciona una imagen válida para la noticia.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setNewsImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newsTitle.trim() || !newsSummary.trim()) return;
    setSavingNews(true);

    let data: any = null;
    let error: any = null;

    if (editingNewsId) {
      const response = await supabase
        .from('news')
        .update({
          title: newsTitle.trim(),
          summary: newsSummary.trim(),
          image_url: newsImagePreview,
        })
        .eq('id', editingNewsId)
        .select('id, title, summary, image_url, published_at')
        .single();
      data = response.data;
      error = response.error;
    } else {
      const response = await supabase
        .from('news')
        .insert({
          title: newsTitle.trim(),
          summary: newsSummary.trim(),
          image_url: newsImagePreview,
        })
        .select('id, title, summary, image_url, published_at')
        .single();
      data = response.data;
      error = response.error;
    }

    if (!error && data) {
      const newItem: NewsItem = {
        id: data.id,
        title: data.title,
        summary: data.summary,
        image_url: data.image_url,
        published_at: data.published_at,
      };
      setNews(prev => {
        const withoutOld = prev.filter(n => n.id !== newItem.id);
        return [newItem, ...withoutOld].slice(0, 5);
      });
      setNewsTitle('');
      setNewsSummary('');
      setNewsImagePreview(null);
      setEditingNewsId(null);
      if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';
      if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
    } else if (error) {
      alert(
        lang === 'en'
          ? 'The news item could not be saved. Check your admin permissions.'
          : 'No se pudo guardar la noticia. Verifica tus permisos de administrador.'
      );
    }

    setSavingNews(false);
  };

  const handleDeleteNews = async (id: string | number) => {
    if (
      !window.confirm(
        lang === 'en'
          ? 'Are you sure you want to delete this news item? This action cannot be undone.'
          : '¿Seguro que deseas eliminar esta noticia? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) {
      alert(
        lang === 'en'
          ? 'The news item could not be deleted.'
          : 'No se pudo eliminar la noticia.'
      );
    } else {
      setNews(prev => prev.filter(n => n.id !== id));
      if (editingNewsId === id) {
        setEditingNewsId(null);
        setNewsTitle('');
        setNewsSummary('');
        setNewsImagePreview(null);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 animate-fadeIn text-black">
      <header className="flex flex-col gap-1">
        <h1 className="text-5xl leading-[0.95] font-black text-emerald-950 tracking-tight">EcoVigia!</h1>
        <p className="text-slate-600 text-base">
          {lang === 'en'
            ? 'Explore and protect the Techo Wetland'
            : 'Explora y protege el Humedal de Techo'}
        </p>
      </header>

      {/* Weather & Env Stats (Mocked) */}
      <section className="eco-card p-4 rounded-[24px] flex justify-between items-center">
        <div className="flex flex-col items-center gap-1">
          <Sun className="text-amber-400" size={28} />
          <span className="text-[32px] font-extrabold text-slate-800">18°C</span>
          <span className="text-[12px] text-slate-500 font-medium">
            {lang === 'en' ? 'Sunny' : 'Soleado'}
          </span>
        </div>
        <div className="h-14 w-[1px] bg-slate-200" />
        <div className="flex flex-col items-center gap-1">
          <Droplets className="text-emerald-500" size={28} />
          <span className="text-[32px] font-extrabold text-slate-800">65%</span>
          <span className="text-[12px] text-slate-500 font-medium">
            {lang === 'en' ? 'Humidity' : 'Humedad'}
          </span>
        </div>
        <div className="h-14 w-[1px] bg-slate-200" />
        <div className="flex flex-col items-center gap-1">
          <Wind className="text-emerald-500" size={28} />
          <span className="text-[32px] font-extrabold text-slate-800">12 km/h</span>
          <span className="text-[12px] text-slate-500 font-medium">
            {lang === 'en' ? 'Air quality' : 'Calidad Aire'}
          </span>
        </div>
      </section>

      {/* Featured Card */}
      <div
        className="relative h-56 rounded-[26px] overflow-hidden shadow-xl cursor-pointer group"
        onClick={() => setActiveTab(AppTab.EDUCATION)}
        style={{
          backgroundImage:
            "linear-gradient(145deg, rgba(4,78,52,0.94), rgba(12,87,66,0.88) 52%, rgba(12,109,80,0.82)), url('/ecovigia-wetland-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'bottom center',
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex justify-between items-start">
            <div className="max-w-[70%]">
              <h2 className="text-white text-[36px] font-extrabold drop-shadow-sm leading-9">
                {lang === 'en' ? 'Local biodiversity' : 'Biodiversidad Local'}
              </h2>
              <p className="text-white/90 text-[15px] leading-6">
                {lang === 'en'
                  ? 'Discover the birds, plants, amphibians and insects of the wetland.'
                  : 'Conoce las aves, plantas, anfibios e insectos del humedal.'}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 text-lime-200/95 drop-shadow-sm">
              <Bird size={30} />
              <Leaf size={20} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-[3px] rounded-full bg-lime-300/80" />
            <p className="text-[12px] text-emerald-50/95">
            {lang === 'en'
              ? 'Tap to explore educational cards about life in the wetland.'
              : 'Toca para explorar fichas educativas sobre la vida del humedal.'}
            </p>
          </div>
        </div>
      </div>

      {showNewsCamera && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl overflow-hidden w-full max-w-sm mx-4 border border-emerald-500/40">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">
                Tomar foto para noticia
              </p>
              <button
                type="button"
                onClick={stopNewsCamera}
                className="text-gray-300 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="relative rounded-xl overflow-hidden bg-black h-56 flex items-center justify-center">
                <video
                  ref={newsVideoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={captureNewsPhoto}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg active:scale-95"
                >
                  Capturar foto
                </button>
                <button
                  type="button"
                  onClick={stopNewsCamera}
                  className="text-xs text-gray-300 hover:text-white px-3 py-2"
                >
                  Cancelar
                </button>
              </div>
              <canvas ref={newsCanvasRef} className="hidden" />
            </div>
          </div>
        </div>
      )}

      {/* Acción principal */}
      <button
        onClick={() => setActiveTab(AppTab.MONITORING)}
        className="eco-card text-emerald-900 px-5 py-4 rounded-[24px] flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
      >
        <div className="w-11 h-11 rounded-full bg-emerald-700/90 text-white flex items-center justify-center shrink-0">
          <Eye size={22} />
        </div>
        <div className="text-left flex-1">
          <span className="font-bold text-lg block text-emerald-900 leading-6">
            {lang === 'en'
              ? 'Make a report'
              : 'Realizar un reporte'}
          </span>
          <span className="text-[12px] text-slate-600">
            {lang === 'en'
              ? 'Record sightings and risks in the wetland'
              : 'Registra avistamientos y riesgos en el humedal'}
          </span>
        </div>
        <ChevronRight size={24} className="text-emerald-700" />
      </button>

      <section>
        <h3 className="text-lg font-bold text-emerald-950 mb-3">
          {lang === 'en' ? 'Recent news' : 'Noticias Recientes'}
        </h3>
        {isAdmin && (
          <form
            onSubmit={handleSaveNews}
            className="mb-4 eco-card rounded-2xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle size={16} className="text-emerald-600" />
                <p className="text-[10px] font-semibold text-gray-500 uppercase">
                  {lang === 'en'
                    ? 'Manage news (admins)'
                    : 'Gestionar noticias (admins)'}
                </p>
              </div>
              {editingNewsId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewsTitle('');
                    setNewsSummary('');
                    setNewsImagePreview(null);
                    if (fileInputCameraRef.current)
                      fileInputCameraRef.current.value = '';
                    if (fileInputGalleryRef.current)
                      fileInputGalleryRef.current.value = '';
                  }}
                  className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} />
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder={
                lang === 'en' ? 'News title' : 'Título de la noticia'
              }
              value={newsTitle}
              onChange={e => setNewsTitle(e.target.value)}
              className="w-full p-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <textarea
              placeholder={
                lang === 'en' ? 'News summary' : 'Resumen de la noticia'
              }
              value={newsSummary}
              onChange={e => setNewsSummary(e.target.value)}
              className="w-full p-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              rows={2}
              required
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startNewsCamera}
                className="flex-1 py-1.5 rounded-xl border border-dashed border-emerald-200 text-[10px] text-emerald-700 flex items-center justify-center gap-1 bg-emerald-50/40"
              >
                <ImageIcon size={14} />
                {lang === 'en' ? 'Take photo' : 'Tomar foto'}
              </button>
              <button
                type="button"
                onClick={() => fileInputGalleryRef.current?.click()}
                className="flex-1 py-1.5 rounded-xl border border-dashed border-emerald-200 text-[10px] text-emerald-700 flex items-center justify-center gap-1 bg-emerald-50/10"
              >
                <ImageIcon size={14} />
                {lang === 'en' ? 'Upload image' : 'Subir imagen'}
              </button>
              <input
                ref={fileInputCameraRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNewsImageChange}
              />
              <input
                ref={fileInputGalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNewsImageChange}
              />
            </div>
            {newsImagePreview && (
              <div className="mt-1 rounded-xl overflow-hidden border border-emerald-50">
                <img
                  src={newsImagePreview}
                  alt={
                    lang === 'en'
                      ? 'News preview'
                      : 'Previsualización noticia'
                  }
                  className="w-full h-20 object-cover"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={savingNews}
              className="w-full mt-1 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-semibold disabled:opacity-60"
            >
              {savingNews
                ? lang === 'en'
                  ? 'Saving...'
                  : 'Guardando...'
                : editingNewsId
                ? lang === 'en'
                  ? 'Save changes'
                  : 'Guardar cambios'
                : lang === 'en'
                ? 'Publish news'
                : 'Publicar noticia'}
            </button>
          </form>
        )}
        <div className="flex flex-col gap-3">
          {(news.length ? news : [
            {
              id: 1,
              title:
                lang === 'en'
                  ? 'Community clean‑up day'
                  : 'Jornada de limpieza comunitaria',
              summary:
                lang === 'en'
                  ? 'This Saturday we will gather to restore the northern area of the wetland.'
                  : 'Este sábado nos reuniremos para restaurar la zona norte del humedal.',
              image_url: null,
              published_at: null,
            },
            {
              id: 2,
              title:
                lang === 'en'
                  ? 'Notable sighting of Blue Gallinule'
                  : 'Avistamiento destacado de Tingua Azul',
              summary:
                lang === 'en'
                  ? 'Rangers report an increase in sightings in the central area.'
                  : 'Guardaparques registran aumento de avistamientos en la zona central.',
              image_url: null,
              published_at: null,
            },
          ]).map((item) => (
            <div key={item.id} className="eco-card-soft p-3 rounded-2xl flex gap-3">
              <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt="News" className="w-full h-full object-cover" />
                ) : (
                  <Newspaper size={22} className="text-emerald-600" />
                )}
              </div>
              <div className="flex flex-col justify-center flex-1">
                <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                {item.published_at && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-2">
                    {new Date(item.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1 items-end">
                  <button
                    onClick={() => {
                      setEditingNewsId(item.id);
                      setNewsTitle(item.title);
                      setNewsSummary(item.summary);
                      setNewsImagePreview(item.image_url || null);
                    }}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Edit2 size={12} />
                    {lang === 'en' ? 'Edit' : 'Editar'}
                  </button>
                  <button
                    onClick={() => handleDeleteNews(item.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    {lang === 'en' ? 'Delete' : 'Eliminar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
