import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { supabase } from './supabaseClient';

const PUSH_WEBHOOK_URL = (import.meta.env.VITE_PUSH_WEBHOOK_URL as string | undefined)?.trim() || '';
const PUSH_WEBHOOK_KEY = (import.meta.env.VITE_PUSH_WEBHOOK_KEY as string | undefined)?.trim() || '';

let pushListenersBound = false;
let currentPushUserId: string | null = null;

export const registerAndroidPushToken = async (userId: string) => {
  if (!userId || Capacitor.getPlatform() !== 'android') return;
  currentPushUserId = userId;

  try {
    const current = await PushNotifications.checkPermissions();
    if (current.receive !== 'granted') {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== 'granted') return;
    }

    if (!pushListenersBound) {
      PushNotifications.addListener('registration', async (token: Token) => {
        if (!currentPushUserId) return;
        try {
          await supabase.from('device_push_tokens').upsert(
            {
              user_id: currentPushUserId,
              platform: 'android',
              token: token.value,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'token' }
          );
        } catch (error) {
          console.warn('No se pudo guardar el token push en Supabase.', error);
        }
      });

      PushNotifications.addListener('registrationError', error => {
        console.warn('Error registrando notificaciones push:', error);
      });

      pushListenersBound = true;
    }

    await PushNotifications.register();
  } catch (error) {
    console.warn('No se pudo inicializar push notifications.', error);
  }
};

export const sendPushTrigger = async (payload: {
  type: 'news' | 'education_event' | 'risk_report';
  title: string;
  body: string;
  recordId?: string;
}) => {
  if (!PUSH_WEBHOOK_URL) return;

  try {
    await fetch(PUSH_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PUSH_WEBHOOK_KEY ? { Authorization: `Bearer ${PUSH_WEBHOOK_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('No se pudo disparar el webhook de notificaciones push.', error);
  }
};
