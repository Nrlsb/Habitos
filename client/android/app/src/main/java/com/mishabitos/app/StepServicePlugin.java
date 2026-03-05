package com.mishabitos.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "StepService",
    permissions = {
        @Permission(
            alias = "activity",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        ),
        @Permission(
            alias = "notifications",
            strings = { "android.permission.POST_NOTIFICATIONS" }
        )
    }
)
public class StepServicePlugin extends Plugin {

    private static final String TAG = "StepServicePlugin";

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "requestPermissions() llamado");

        boolean hasActivity = true;
        boolean hasNotif = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasActivity = ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= 33) {
            hasNotif = ContextCompat.checkSelfPermission(getContext(),
                "android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        }

        Log.d(TAG, "Permisos actuales - activity=" + hasActivity + ", notifications=" + hasNotif);

        if (hasActivity && hasNotif) {
            JSObject result = new JSObject();
            result.put("activity", "granted");
            result.put("notifications", "granted");
            call.resolve(result);
            return;
        }

        if (!hasActivity && !hasNotif) {
            requestAllPermissions(call, "permissionsCallback");
        } else if (!hasActivity) {
            requestPermissionForAlias("activity", call, "permissionsCallback");
        } else {
            requestPermissionForAlias("notifications", call, "permissionsCallback");
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        boolean hasActivity = true;
        boolean hasNotif = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasActivity = ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= 33) {
            hasNotif = ContextCompat.checkSelfPermission(getContext(),
                "android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        }

        Log.d(TAG, "Resultado permisos - activity=" + hasActivity + ", notifications=" + hasNotif);

        JSObject result = new JSObject();
        result.put("activity", hasActivity ? "granted" : "denied");
        result.put("notifications", hasNotif ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Log.d(TAG, "startService() llamado");
        Context ctx = getContext();
        Intent intent = new Intent(ctx, StepCounterService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "Usando startForegroundService (API >= O)");
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            Log.d(TAG, "startService() exitoso");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error en startService(): " + e.getMessage(), e);
            call.reject("Error starting service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, StepCounterService.class);
        ctx.stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStepCount(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            StepCounterService.PREFS_NAME, Context.MODE_PRIVATE);
        int steps = prefs.getInt(StepCounterService.KEY_STEPS_TODAY, 0);
        String date = prefs.getString(StepCounterService.KEY_STEP_DATE, "");
        Log.d(TAG, "getStepCount() -> steps=" + steps + ", date=" + date);

        JSObject result = new JSObject();
        result.put("steps", steps);
        result.put("date", date);
        call.resolve(result);
    }

    @PluginMethod
    public void setGoal(PluginCall call) {
        Integer goal = call.getInt("goal");
        Log.d(TAG, "setGoal() llamado con goal=" + goal);
        if (goal == null) {
            Log.e(TAG, "setGoal() - goal es null");
            call.reject("goal required");
            return;
        }
        getContext().getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(StepCounterService.KEY_STEPS_GOAL, goal)
            .apply();
        Log.d(TAG, "setGoal() exitoso, guardado goal=" + goal);
        call.resolve();
    }
}
