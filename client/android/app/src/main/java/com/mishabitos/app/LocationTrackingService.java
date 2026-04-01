package com.mishabitos.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class LocationTrackingService extends Service {

    private static final String TAG = "LocationTrackingSvc";
    static final String CHANNEL_ID = "location_tracking_channel";
    static final int NOTIF_ID = 43;
    private static final long INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000L; // 5 min
    private static final float MIN_DISTANCE_METERS = 5.0f;
    private static final long MIN_TIME_MS = 3000L; // 3 seg entre actualizaciones GPS

    // Path accesible estáticamente desde el plugin (mismo proceso, mismo looper)
    static final List<double[]> collectedPath = new ArrayList<>(); // [lat, lng, timestamp_ms, speed_m/s]

    // Listener para callbacks al plugin
    interface LocationUpdateListener {
        void onLocationUpdate(double lat, double lng, long timestamp, float speed, double distanceMeters);
        void onTrackingStopped(double distanceMeters);
    }
    static LocationUpdateListener listener;

    private LocationManager locationManager;
    private Location lastLocation;
    private double totalDistanceMeters = 0;
    private Handler inactivityHandler;
    private Runnable inactivityRunnable;

    private final LocationListener gpsListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            handleLocationUpdate(location);
        }
        @Override public void onStatusChanged(String p, int s, Bundle e) {}
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {
            Log.w(TAG, "GPS provider desactivado: " + p);
        }
    };

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate()");
        inactivityHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        startForegroundCompat();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand() — iniciando nueva sesión");
        collectedPath.clear();
        totalDistanceMeters = 0;
        lastLocation = null;

        startLocationUpdates();
        resetInactivityTimer();

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy()");
        if (locationManager != null) {
            locationManager.removeUpdates(gpsListener);
        }
        cancelInactivityTimer();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ─── GPS ──────────────────────────────────────────────────────────────────

    private void startLocationUpdates() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                MIN_TIME_MS,
                0f, // sin filtro de distancia mínima (lo hacemos manual)
                gpsListener,
                Looper.getMainLooper()
            );
            Log.d(TAG, "GPS updates iniciados");
        } catch (SecurityException e) {
            Log.e(TAG, "Permiso de ubicación denegado: " + e.getMessage());
            stopSelf();
        }
    }

    private void handleLocationUpdate(Location location) {
        float distFromLast = (lastLocation != null)
            ? lastLocation.distanceTo(location)
            : MIN_DISTANCE_METERS + 1f;

        // Filtrar puntos con menos de 5 metros de desplazamiento
        if (lastLocation != null && distFromLast < MIN_DISTANCE_METERS) return;

        if (lastLocation != null) totalDistanceMeters += distFromLast;
        lastLocation = location;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        long ts = location.getTime();
        float speed = location.hasSpeed() ? location.getSpeed() : 0f;

        collectedPath.add(new double[]{lat, lng, (double) ts, speed});
        Log.d(TAG, "Punto #" + collectedPath.size() + " lat=" + lat + " lng=" + lng
            + " dist=" + String.format(Locale.US, "%.1f", totalDistanceMeters) + "m");

        resetInactivityTimer();
        updateNotification();

        if (listener != null) {
            listener.onLocationUpdate(lat, lng, ts, speed, totalDistanceMeters);
        }
    }

    // ─── Inactividad ──────────────────────────────────────────────────────────

    private void resetInactivityTimer() {
        cancelInactivityTimer();
        inactivityRunnable = () -> {
            Log.d(TAG, "Timeout de inactividad (5 min) — guardando sesión");
            if (listener != null) {
                listener.onTrackingStopped(totalDistanceMeters);
                listener = null;
            }
            stopSelf();
        };
        inactivityHandler.postDelayed(inactivityRunnable, INACTIVITY_TIMEOUT_MS);
    }

    private void cancelInactivityTimer() {
        if (inactivityRunnable != null) {
            inactivityHandler.removeCallbacks(inactivityRunnable);
            inactivityRunnable = null;
        }
    }

    // ─── Notificación ─────────────────────────────────────────────────────────

    private void startForegroundCompat() {
        Notification n = buildNotification(0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, n,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private Notification buildNotification(double distMeters) {
        String text;
        if (distMeters == 0) {
            text = "Esperando señal GPS...";
        } else if (distMeters < 1000) {
            text = String.format(Locale.getDefault(), "%.0f m recorridos", distMeters);
        } else {
            text = String.format(Locale.getDefault(), "%.2f km recorridos", distMeters / 1000.0);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Registrando caminata")
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(totalDistanceMeters));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Registro de caminata",
                NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("Servicio GPS activo para registrar caminatas automáticamente");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }
}
