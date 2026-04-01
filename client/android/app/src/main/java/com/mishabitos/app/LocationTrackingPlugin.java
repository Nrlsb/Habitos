package com.mishabitos.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "LocationTracking",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class LocationTrackingPlugin extends Plugin {

    private static final String TAG = "LocationTrackingPlugin";

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermCallback");
            return;
        }
        doStartTracking(call);
    }

    @PermissionCallback
    private void locationPermCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Permiso de ubicación denegado");
            return;
        }
        doStartTracking(call);
    }

    private void doStartTracking(PluginCall call) {
        // Registrar listener estático para recibir callbacks del servicio
        LocationTrackingService.listener = new LocationTrackingService.LocationUpdateListener() {
            @Override
            public void onLocationUpdate(double lat, double lng, long timestamp, float speed, double distanceMeters) {
                JSObject data = new JSObject();
                data.put("lat", lat);
                data.put("lng", lng);
                data.put("timestamp", timestamp);
                data.put("speed", speed);
                data.put("distance", distanceMeters);
                notifyListeners("locationUpdate", data);
            }

            @Override
            public void onTrackingStopped(double distanceMeters) {
                // Auto-stop por inactividad: devolver el path completo al JS
                JSObject data = new JSObject();
                data.put("path", buildPathArray());
                data.put("distance", distanceMeters);
                data.put("reason", "inactivity");
                notifyListeners("trackingStopped", data);
                LocationTrackingService.listener = null;
            }
        };

        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, LocationTrackingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(serviceIntent);
        } else {
            ctx.startService(serviceIntent);
        }

        Log.d(TAG, "startTracking() OK");
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        // Leer el path ANTES de parar el servicio
        JSArray path = buildPathArray();
        Log.d(TAG, "stopTracking() — " + LocationTrackingService.collectedPath.size() + " puntos");

        // Quitar listener antes de detener para que onDestroy no dispare eventos
        LocationTrackingService.listener = null;

        getContext().stopService(new Intent(getContext(), LocationTrackingService.class));

        JSObject result = new JSObject();
        result.put("path", path);
        call.resolve(result);
    }

    private JSArray buildPathArray() {
        JSArray path = new JSArray();
        for (double[] point : LocationTrackingService.collectedPath) {
            JSObject p = new JSObject();
            p.put("lat", point[0]);
            p.put("lng", point[1]);
            p.put("timestamp", (long) point[2]);
            p.put("speed", (float) point[3]);
            path.put(p);
        }
        return path;
    }
}
