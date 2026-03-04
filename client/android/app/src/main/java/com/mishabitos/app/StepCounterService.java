package com.mishabitos.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StepCounterService extends Service implements SensorEventListener {

    static final String PREFS_NAME = "StepCounterPrefs";
    static final String KEY_STEPS_TODAY = "steps_today";
    static final String KEY_STEP_DATE = "step_date";
    static final String KEY_SENSOR_BASELINE = "sensor_baseline";
    static final String KEY_STEPS_GOAL = "steps_goal";

    private static final String CHANNEL_ID = "step_service_channel";
    private static final int NOTIF_ID = 42;

    private SensorManager sensorManager;
    private long sensorBaseline = -1;
    private String currentDate;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification(0));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        currentDate = getTodayDate();
        String savedDate = prefs.getString(KEY_STEP_DATE, "");

        if (!savedDate.equals(currentDate)) {
            // Nuevo día: reiniciar baseline y pasos
            prefs.edit()
                .putString(KEY_STEP_DATE, currentDate)
                .putInt(KEY_STEPS_TODAY, 0)
                .putLong(KEY_SENSOR_BASELINE, -1)
                .apply();
            sensorBaseline = -1;
        } else {
            sensorBaseline = prefs.getLong(KEY_SENSOR_BASELINE, -1);
        }

        // Registrar el sensor de pasos
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        Sensor stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
        }

        return START_STICKY; // El sistema lo reinicia si lo mata
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ─── SensorEventListener ─────────────────────────────────────────────────

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        long sensorValue = (long) event.values[0];
        String todayDate = getTodayDate();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        // Cambio de día
        if (!todayDate.equals(currentDate)) {
            currentDate = todayDate;
            sensorBaseline = sensorValue;
            prefs.edit()
                .putString(KEY_STEP_DATE, currentDate)
                .putLong(KEY_SENSOR_BASELINE, sensorBaseline)
                .putInt(KEY_STEPS_TODAY, 0)
                .apply();
            updateNotification(0);
            triggerWidgetUpdate(0);
            return;
        }

        // Primera lectura o reset por reinicio del dispositivo
        if (sensorBaseline < 0 || sensorValue < sensorBaseline) {
            sensorBaseline = sensorValue;
            prefs.edit().putLong(KEY_SENSOR_BASELINE, sensorBaseline).apply();
        }

        int stepsToday = (int) (sensorValue - sensorBaseline);
        prefs.edit().putInt(KEY_STEPS_TODAY, stepsToday).apply();

        updateNotification(stepsToday);
        triggerWidgetUpdate(stepsToday);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void triggerWidgetUpdate(int steps) {
        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        int[] ids = manager.getAppWidgetIds(new ComponentName(this, StepWidget.class));
        for (int id : ids) {
            StepWidget.updateAppWidget(this, manager, id);
        }
    }

    private Notification buildNotification(int steps) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        int goal = prefs.getInt(KEY_STEPS_GOAL, 8000);
        String text = (steps < 0) ? "Sensor de pasos no disponible" : formatNumber(steps) + " / " + formatNumber(goal) + " pasos hoy";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Contador de Pasos")
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void updateNotification(int steps) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(steps));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Contador de pasos",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Servicio de conteo de pasos en segundo plano");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private String getTodayDate() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
    }

    private String formatNumber(int n) {
        if (n >= 1000) {
            return String.format(Locale.getDefault(), "%,d", n);
        }
        return String.valueOf(n);
    }
}
