import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { lang } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error: err } =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password, username);

    if (err) {
      let friendly = err;
      if (mode === 'register') {
        if (err === 'USERNAME_TAKEN') {
          friendly =
            lang === 'en'
              ? 'This username is already in use. Please choose a different one.'
              : 'Este nombre de usuario ya está en uso. Por favor, elige uno diferente.';
        } else if (err === 'USERNAME_REQUIRED') {
          friendly =
            lang === 'en'
              ? 'Please choose a username to create your account.'
              : 'Por favor elige un nombre de usuario para crear tu cuenta.';
        } else {
          const lower = err.toLowerCase();

          // Caso 1: el correo ya existe
          if (lower.includes('already registered') || lower.includes('already exists')) {
            friendly =
              lang === 'en'
                ? 'This email is already registered. Please sign in instead.'
                : 'Este correo ya se encuentra registrado. Por favor, inicia sesión.';
          }
          // Caso 2: muchos intentos de registro seguidos
          else if (lower.includes('rate limit')) {
            friendly =
              lang === 'en'
                ? 'There have been too many registration attempts. Please wait a few minutes before trying again.'
                : 'Se han realizado demasiados intentos de registro. Espera unos minutos antes de intentarlo de nuevo.';
          }
          // Caso 3: problemas con el nombre de usuario (por ejemplo, ya está en uso) a partir de errores de Supabase
          else if (
            lower.includes('username') ||
            lower.includes('user name') ||
            lower.includes('duplicate key value')
          ) {
            friendly =
              lang === 'en'
                ? 'This username is already in use. Please choose a different one.'
                : 'Este nombre de usuario ya está en uso. Por favor, elige uno diferente.';
          }
        }
      }
      setError(friendly);
    } else {
      if (mode === 'login') {
        setSuccess(
          lang === 'en' ? 'Sign in successful.' : 'Inicio de sesión exitoso.'
        );
      } else {
        setSuccess(
          lang === 'en'
            ? 'Registration successful. Check your email if confirmation is required.'
            : 'Registro exitoso. Revisa tu correo si se requiere confirmación.'
        );
      }
    }

    setLoading(false);
  };

  return (
    <div className="p-6 animate-fadeIn text-black">
      <h1 className="text-2xl font-bold text-black mb-4">
        {mode === 'login'
          ? lang === 'en'
            ? 'Sign in'
            : 'Inicia sesión'
          : lang === 'en'
          ? 'Create your account'
          : 'Crea tu cuenta'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {lang === 'en'
          ? 'To participate in the community and record citizen reports, please sign in or register.'
          : 'Para participar en la comunidad y registrar reportes ciudadanos, inicia sesión o regístrate.'}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            mode === 'login'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {lang === 'en' ? 'Sign in' : 'Iniciar sesión'}
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            mode === 'register'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {lang === 'en' ? 'Register' : 'Registrarse'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {lang === 'en' ? 'Username (unique)' : 'Nombre de usuario (único)'}
            </label>
            <input
              type="text"
              required={mode === 'register'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: humedal_guardian"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {lang === 'en'
                ? 'It will appear as @username in your reports.'
                : 'Se mostrará como @usuario en tus reportes.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            {lang === 'en' ? 'Email' : 'Correo electrónico'}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={
              lang === 'en' ? 'your-email@example.com' : 'tu-correo@ejemplo.com'
            }
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            {lang === 'en' ? 'Password' : 'Contraseña'}
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={
              lang === 'en' ? 'Minimum 6 characters' : 'Mínimo 6 caracteres'
            }
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {loading
            ? lang === 'en'
              ? 'Processing...'
              : 'Procesando...'
            : mode === 'login'
            ? lang === 'en'
              ? 'Enter'
              : 'Entrar'
            : lang === 'en'
            ? 'Create account'
            : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
};

export default AuthScreen;
